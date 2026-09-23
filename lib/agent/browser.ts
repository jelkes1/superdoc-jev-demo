import type { SuperDoc as Editor } from "superdoc";
import type { AgentEvent, Lane, Pipeline, PlanResult, Snapshot } from "./types";
import { documentIndex, executeEdit } from "./document";
export async function createEditor(
  mount: HTMLElement,
  document: File,
  toolbar?: string,
  documentMode: "editing" | "viewing" = "editing",
): Promise<Editor> {
  const { SuperDoc } = await import("superdoc");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sd?.destroy();
      reject(new Error("The document editor did not become ready."));
    }, 60000);
    const sd = new SuperDoc({
      selector: mount,
      document,
      documentMode,
      role: "editor",
      user: { name: "SuperDoc document agent", email: "agent@example.invalid" },
      ui: {
        toolbar: toolbar
          ? { container: toolbar, responsiveToContainer: true }
          : false,
        comments: { layout: "inline" },
        search: true,
        ruler: false,
      },
      zoom: { mode: "manual", initial: 80 },
      onReady: () => {
        clearTimeout(timer);
        resolve(sd);
      },
      onException: () => {
        clearTimeout(timer);
        reject(new Error("The editor could not open this document."));
      },
    });
  });
}
export async function post<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(result.error ?? "The request could not complete.");
  return result;
}
export interface AgentTransport {
  start(
    s: Snapshot,
    pipelines: Pipeline[],
    signal?: AbortSignal,
  ): Promise<{ runId: string; snapshot: string }>;
  plan(
    s: Snapshot,
    runId: string,
    pipeline: Pipeline,
    onEvent: (e: AgentEvent) => void,
    signal?: AbortSignal,
  ): Promise<PlanResult>;
  finish(runId: string): Promise<unknown>;
}
export const transport: AgentTransport = {
  start: (snapshot, pipelines, signal) =>
    post("/api/agent/start", { snapshot, pipelines }, signal),
  async plan(snapshot, runId, pipeline, onEvent, signal) {
    const response = await fetch("/api/agent/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, runId, pipeline }),
      signal,
    });
    if (!response.ok)
      throw new Error(
        ((await response.json()) as { error?: string }).error ??
          "The pipeline could not run.",
      );
    const reader = response.body!.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      result: PlanResult | undefined;
    while (true) {
      const r = await reader.read();
      buffer += decoder.decode(r.value, { stream: !r.done });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const l of lines)
        if (l.trim()) {
          const e = JSON.parse(l) as AgentEvent;
          onEvent(e);
          if (e.type === "result") result = e.result;
        }
      if (r.done) break;
    }
    if (!result)
      throw new Error("The response was interrupted. No edits were applied.");
    return result;
  },
  finish: (runId) => post("/api/agent/finish", { runId }),
};
export function emptyLane(pipeline: Pipeline): Lane {
  return {
    pipeline,
    executions: [],
    extractionMs: 0,
    planningMs: 0,
    executionMs: 0,
    firstVerifiedMs: null,
    failed: 0,
    timingValid: !document.hidden,
  };
}
export async function frozenCopy(
  file: File,
  mount: HTMLElement,
  request: string,
  hash: string,
) {
  const editor = await createEditor(mount, file);
  const t = performance.now();
  try {
    return {
      editor,
      snapshot: await documentIndex(editor.activeEditor!.doc!, request, hash),
      extractionMs: performance.now() - t,
    };
  } catch (e) {
    editor.destroy();
    throw e;
  }
}
export function assertSameContent(a: Snapshot, b: Snapshot) {
  const content = (s: Snapshot) =>
    JSON.stringify(
      s.blocks.map((b) => [
        b.id,
        b.text,
        b.title,
        b.section,
        b.existingRevisions.length,
      ]),
    );
  if (content(a) !== content(b))
    throw new Error("The comparison copy differs from the frozen document.");
}
export async function applyLane(
  editor: Editor,
  s: Snapshot,
  lane: Lane,
  selected: string[],
  onUpdate: (lane: Lane) => void = () => {},
) {
  const doc = editor.activeEditor!.doc!;
  let revision = (await doc.info({})).revision;
  if (revision !== s.revision)
    throw new Error(
      "The document changed after planning. Recheck before creating redlines.",
    );
  const t = performance.now();
  const invalidate = () => {
    lane.timingValid = false;
  };
  document.addEventListener("visibilitychange", invalidate);
  try {
    for (const edit of lane.result?.plan.edits ?? []) {
      if (
        !selected.includes(edit.id) ||
        lane.executions.some((e) => e.edit.id === edit.id)
      )
        continue;
      try {
        const op = await executeEdit(doc, s, edit, revision);
        lane.executions.push(op);
        revision = op.afterRevision;
        if (!op.verified) lane.failed++;
        else if (edit.tool === "replace")
          lane.firstVerifiedMs ??=
            lane.extractionMs +
            lane.planningMs +
            lane.executionMs +
            performance.now() -
            t;
      } catch (e) {
        lane.failed++;
        lane.executions.push({
          edit,
          changeIds: [],
          fingerprints: {},
          beforeRevision: revision,
          afterRevision: (await doc.info({})).revision,
          verified: false,
          preserved: false,
          commentVerified: false,
          receipt: null,
          status: "pending",
          error: e instanceof Error ? e.message : "Operation failed.",
        });
        break;
      }
      onUpdate({ ...lane });
    }
  } finally {
    lane.executionMs += performance.now() - t;
    document.removeEventListener("visibilitychange", invalidate);
    onUpdate({ ...lane });
  }
  return lane;
}
export async function fileHash(file: Blob) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function trackVisibility(lane: Lane) {
  const invalidate = () => {
    if (document.hidden) lane.timingValid = false;
  };
  invalidate();
  document.addEventListener("visibilitychange", invalidate);
  return () => document.removeEventListener("visibilitychange", invalidate);
}
