import type { SuperDoc } from "superdoc";
import type { CompareInput } from "../compare/input";
import {
  MODELS,
  type CompareModel,
  type CompareResult,
} from "../compare/types";
import {
  readDocument,
  applyOperation,
  type Reading,
  type Operation,
} from "../deal-desk/document";
import {
  DEFAULT_POLICY,
  VERSION,
  RULES,
  type RuleId,
} from "../deal-desk/rules";
import { fingerprint, listChanges } from "../review/document";
import {
  WORKFLOW_VERSION,
  REPLACEMENTS,
  rotatedModels,
  type WorkflowArtifact,
  type WorkflowResult,
} from "./types";
import type { WorkflowInput } from "./input";

export const modelLabel = (m: CompareModel) =>
  m === MODELS[0] ? "Jev" : m === MODELS[1] ? "GPT-5.4 mini" : "GPT-5.4";
export async function sha(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function openCopy(
  mount: HTMLElement,
  blob: Blob,
  viewing = false,
) {
  const { SuperDoc } = await import("superdoc");
  mount.replaceChildren();
  return await new Promise<SuperDoc>((resolve, reject) => {
    const timeout = setTimeout(() => {
      sd?.destroy();
      reject(new Error("Comparison document did not become ready."));
    }, 30000);
    const sd = new SuperDoc({
      selector: mount,
      document: new File([blob], "comparison.docx"),
      documentMode: viewing ? "viewing" : "editing",
      role: "editor",
      user: {
        name: "SuperDoc · Comparison",
        email: "comparison@example.invalid",
      },
      ui: { comments: { layout: "inline" }, ruler: false },
      zoom: { mode: "manual", initial: 75 },
      onReady: () => {
        clearTimeout(timeout);
        resolve(sd);
      },
      onException: () => {
        clearTimeout(timeout);
        reject(new Error("Comparison editor reported an error."));
      },
    });
  });
}
export function contextFor(reading: Reading, hash: string): CompareInput {
  return {
    revision: hash,
    version: VERSION,
    policy: DEFAULT_POLICY,
    rows: reading.rows.map((r) => ({
      id: r.id,
      text: r.clause?.text ?? "",
      context: r.context,
    })),
  };
}
export interface FrozenWorkflow {
  blob: Blob;
  documentHash: string;
  input: CompareInput;
  proposals: { id: RuleId; label: string; before: string; after: string }[];
}
export async function prepareWorkflow(
  mount: HTMLElement,
): Promise<FrozenWorkflow> {
  const res = await fetch("/deal-desk.docx");
  if (!res.ok) throw new Error("The fictional agreement is unavailable.");
  const blob = await res.blob(),
    documentHash = await sha(await blob.arrayBuffer());
  const sd = await openCopy(mount, blob);
  try {
    const reading = await readDocument(sd.activeEditor!.doc!, DEFAULT_POLICY);
    if (reading.tokens > 25000 || blob.size > 10 * 1024 * 1024)
      throw new Error("Comparison sample exceeds input limits.");
    const proposals = [...REPLACEMENTS, "safeguard" as RuleId].map((id) => {
      const row = reading.rows.find((r) => r.id === id)!;
      if (
        row.problem ||
        !row.replacement ||
        !row.clause ||
        row.existing.length ||
        row.present
      )
        throw new Error(`Sample cannot support ${id}.`);
      return {
        id,
        label: RULES.find((r) => r.id === id)!.label,
        before: id === "safeguard" ? "" : row.clause.text,
        after: row.replacement,
      };
    });
    return {
      blob,
      documentHash,
      input: contextFor(reading, documentHash),
      proposals,
    };
  } finally {
    sd.destroy();
    mount.replaceChildren();
  }
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      (data as { error?: string }).error || "Comparison request failed.",
    );
  return data as T;
}
export interface WorkflowTransport {
  start(body: WorkflowInput): Promise<{ runId: string; snapshot: string }>;
  model(
    body: WorkflowInput & { runId: string; model: CompareModel },
  ): Promise<CompareResult>;
  finish(runId: string): Promise<unknown>;
}
export const hostedTransport: WorkflowTransport = {
  start: (body) => post("/api/compare/workflow/start", body),
  model: (body) => post("/api/compare/workflow/model", body),
  finish: (runId) => post("/api/compare/workflow/finish", { runId }),
};
export async function runWorkflow(
  mount: HTMLElement,
  frozen: FrozenWorkflow,
  options: {
    safeguard: boolean;
    repetition?: number;
    signal?: AbortSignal;
    transport?: WorkflowTransport;
    onProgress?: (model: CompareModel, phase: string) => void;
    onResult?: (artifact: WorkflowArtifact) => void | Promise<void>;
  },
) {
  const selected = frozen.proposals.filter(
    (p) => p.id !== "safeguard" || options.safeguard,
  );
  const body: WorkflowInput = {
    input: frozen.input,
    documentHash: frozen.documentHash,
    approvalHash: await sha(JSON.stringify(selected)),
    version: WORKFLOW_VERSION,
    safeguard: options.safeguard,
  };
  const transport = options.transport ?? hostedTransport;
  const run = await transport.start(body),
    artifacts: WorkflowArtifact[] = [];
  try {
    for (const model of rotatedModels(MODELS, options.repetition ?? 0)) {
      if (options.signal?.aborted) break;
      options.onProgress?.(model, "Opening a fresh copy");
      const sd = await openCopy(mount, frozen.blob);
      let timingValid = document.visibilityState === "visible";
      const invalidate = () => {
        if (document.visibilityState !== "visible") timingValid = false;
      };
      document.addEventListener("visibilitychange", invalidate);
      try {
        const doc = sd.activeEditor!.doc!,
          start = performance.now();
        let reading = await readDocument(doc, DEFAULT_POLICY);
        if (
          JSON.stringify(contextFor(reading, frozen.documentHash)) !==
          JSON.stringify(frozen.input)
        )
          throw new Error("Comparison evidence changed between copies.");
        const original = await Promise.all(
          reading.changes.map((c) => doc.trackChanges.get({ id: c.id })),
        );
        const extractionMs = performance.now() - start;
        options.onProgress?.(model, "Reading → deciding");
        const decisionStart = performance.now();
        let comparison: CompareResult;
        try {
          comparison = await transport.model({
            ...body,
            runId: run.runId,
            model,
          });
        } catch (e) {
          comparison = {
            model,
            snapshot: run.snapshot,
            status: "incomplete",
            elapsedMs: performance.now() - decisionStart,
            verdicts: [],
            usage: null,
            error: e instanceof Error ? e.message : "Provider failed.",
          };
        }
        const decisionMs = performance.now() - decisionStart;
        if (comparison.model !== model || comparison.snapshot !== run.snapshot)
          throw new Error("Model result does not match the frozen comparison.");
        const executionStart = performance.now(),
          operations: Operation[] = [],
          errors: string[] = [];
        let attempted = 0,
          failed = 0,
          firstVerifiedMs: number | null = null;
        options.onProgress?.(model, "Creating & verifying Word redlines");
        if (comparison.status === "complete") {
          for (const proposal of selected) {
            if (options.signal?.aborted) {
              errors.push("Comparison canceled.");
              break;
            }
            const verdict = comparison.verdicts.find(
              (v) => v.id === proposal.id,
            )?.verdict;
            // The missing safeguard was separately approved by the person, for all copies.
            // Replacements require the model's violation judgment; no confidence is fabricated.
            if (proposal.id !== "safeguard" && verdict !== "UNACCEPTABLE")
              continue;
            attempted++;
            try {
              const op = await applyOperation(
                doc,
                reading,
                proposal.id,
                DEFAULT_POLICY,
                undefined,
                true,
              );
              operations.push(op);
              if (!op.verified) {
                failed++;
                errors.push(`${proposal.id}: execution verification failed.`);
              } else firstVerifiedMs ??= performance.now() - start;
              reading = await readDocument(doc, DEFAULT_POLICY);
            } catch (e) {
              failed++;
              errors.push(
                e instanceof Error ? e.message : "Document execution failed.",
              );
              reading = await readDocument(doc, DEFAULT_POLICY);
            }
          }
        } else errors.push(comparison.error ?? "Incomplete provider result.");
        const changes = await listChanges(doc),
          current = await Promise.all(
            changes.map((c) => doc.trackChanges.get({ id: c.id })),
          );
        const preserved = original.every((c) =>
          current.some(
            (n) => n.id === c.id && fingerprint(n) === fingerprint(c),
          ),
        );
        const expectedOutcome =
          preserved &&
          !failed &&
          selected.every((p) =>
            operations.some(
              (o) =>
                o.id === p.id &&
                o.after === p.after &&
                o.verified &&
                o.preserved,
            ),
          );
        const unresolved = RULES.filter(
          (r) =>
            r.kind === "review" ||
            (r.kind !== "preserve" &&
              !operations.some((o) => o.id === r.id && o.verified)),
        ).map((r) => r.id);
        const outcome = JSON.stringify({
          operations: operations
            .filter((o) => o.verified)
            .map((o) => ({
              id: o.id,
              before: o.before,
              after: o.after,
              kind: o.kind,
            }))
            .sort((a, b) => a.id.localeCompare(b.id)),
          unresolved: [...unresolved].sort(),
          preserved,
        });
        const end = performance.now();
        const result: WorkflowResult = {
          model,
          snapshot: run.snapshot,
          documentHash: frozen.documentHash,
          version: WORKFLOW_VERSION,
          safeguard: options.safeguard,
          status:
            comparison.status === "complete" && !errors.length
              ? "complete"
              : "incomplete",
          comparison,
          timing: {
            extractionMs,
            decisionMs,
            executionMs: end - executionStart,
            activeMs: end - start,
            firstVerifiedMs,
          },
          timingValid,
          operations,
          attempted,
          failed,
          unresolved,
          preserved,
          expectedOutcome,
          outcome,
          errors,
        };
        // Export is outside processing time, as it is in the main walkthrough.
        let blob: Blob | undefined;
        try {
          blob = await sd.export({
            triggerDownload: false,
            commentsType: "external",
          });
        } catch {
          result.errors.push("The comparison DOCX could not be exported.");
          result.status = "incomplete";
        }
        const artifact = { result, blob };
        artifacts.push(artifact);
        await options.onResult?.(artifact);
      } finally {
        document.removeEventListener("visibilitychange", invalidate);
        sd.destroy();
        mount.replaceChildren();
      }
    }
  } finally {
    await transport.finish(run.runId);
  }
  return artifacts;
}
