/** Genuine provider calls, real browser execution, durable $2 ledger; fictional documents only. */
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { validateSnapshot } from "../lib/agent/selection";
import { runPipeline, reservationSlots } from "../lib/agent/pipeline";
import {
  PIPELINES,
  type Lane,
  type Snapshot,
  type Pipeline,
} from "../lib/agent/types";
import { evaluateLane, type ExpectedCase } from "../lib/agent/evaluation";
const out = process.env.AGENT_EVAL_OUT ?? "docs/agent-evaluation-v1.json",
  fixture = JSON.parse(await readFile("fixtures/agent/expected.json", "utf8"));
const rounds = Number(process.env.AGENT_EVAL_ROUNDS ?? 5),
  cap = 2000000;
const frozenCommit = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", "fixtures/agent/expected.json"],
  { encoding: "utf8" },
).trim();
if (
  !frozenCommit ||
  execFileSync(
    "git",
    ["status", "--porcelain", "--", "fixtures/agent/expected.json"],
    { encoding: "utf8" },
  ).trim()
)
  throw new Error("Commit the expected outcomes before calling providers.");
if (!process.env.TYPESAFE_API_KEY || !process.env.OPENAI_API_KEY)
  throw new Error("Both model keys are required.");
await mkdir("outputs/agent-evaluation", { recursive: true });
type Recorded = {
  case: string;
  repetition: number;
  lane: Lane;
  evaluation: ReturnType<typeof evaluateLane>;
  export?: string;
};
let report: {
  version: string;
  frozenCommit: string;
  documentHash: string;
  capUsd: number;
  heldMicro: number;
  complete: boolean;
  runs: Recorded[];
  attempts: unknown[];
  error?: string;
} = {
  version: "agent-evaluation-v1",
  frozenCommit,
  documentHash: fixture.documentHash,
  capUsd: 2,
  heldMicro: 0,
  complete: false,
  runs: [],
  attempts: [],
};
try {
  report.heldMicro = JSON.parse(
    await readFile("docs/agent-pilot-v1.json", "utf8"),
  ).heldMicro;
} catch {
  /* no earlier pilot */
}
try {
  const prior = JSON.parse(await readFile(out, "utf8"));
  if (prior.documentHash !== fixture.documentHash)
    throw new Error("Changed fixture");
  report = prior;
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const persist = () => writeFile(out, JSON.stringify(report, null, 2) + "\n");
const browser = await chromium.launch(),
  page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.addInitScript({ content: "window.__name=(fn)=>fn;" });
try {
  for (let rep = 0; rep < rounds; rep++)
    for (const expected of fixture.cases as ExpectedCase[]) {
      const order = PIPELINES.map(
        (_, i) => PIPELINES[(i + rep) % PIPELINES.length],
      );
      for (const p of order) {
        if (
          report.runs.some(
            (r) =>
              r.case === expected.id &&
              r.repetition === rep + 1 &&
              r.lane.pipeline === p,
          )
        )
          continue;
        await page.goto(
          process.env.DEMO_BASE_URL ?? "http://localhost:5173/agent",
        );
        await page.waitForFunction(
          () => !!(window as unknown as { __agent: unknown }).__agent,
          { timeout: 60000 },
        );
        const extraction = await page.evaluate(
          async ({ request, hash }) => {
            const w = window as unknown as {
              __agent: {
                editor: import("superdoc").SuperDoc;
                index: typeof import("../lib/agent/document").documentIndex;
              };
            };
            const t = performance.now();
            const s = await w.__agent.index(
              w.__agent.editor.activeEditor!.doc!,
              request,
              hash,
            );
            return { s, ms: performance.now() - t };
          },
          { request: expected.request, hash: fixture.documentHash },
        );
        const s = validateSnapshot(extraction.s),
          parts = reservationSlots(s, [p]),
          maximum = Object.values(parts).reduce((a, b) => a + b, 0);
        if (report.heldMicro + maximum > cap) {
          report.error =
            "Stopped before exceeding the $2 local evaluation allowance.";
          await persist();
          throw new Error(report.error);
        }
        report.heldMicro += maximum;
        const claimed = new Set<string>();
        await persist();
        const hash = createHash("sha256")
            .update(JSON.stringify(s))
            .digest("hex"),
          start = performance.now();
        const result = await runPipeline(
          s,
          p,
          hash,
          {
            jev: process.env.TYPESAFE_API_KEY,
            openai: process.env.OPENAI_API_KEY,
          },
          () => {},
          {
            async start(slot) {
              if (claimed.has(slot))
                throw new Error("Duplicate evaluation call");
              claimed.add(slot);
              report.attempts.push({
                case: expected.id,
                repetition: rep + 1,
                pipeline: p,
                slot,
                startedAt: new Date().toISOString(),
              });
              await persist();
            },
            async finish(slot, cost) {
              if (cost !== null) report.heldMicro += cost - parts[slot];
              await persist();
            },
          },
        );
        for (const slot of Object.keys(parts))
          if (!claimed.has(slot)) report.heldMicro -= parts[slot];
        const l: Lane = {
          pipeline: p,
          result,
          executions: [],
          extractionMs: extraction.ms,
          planningMs: performance.now() - start,
          executionMs: 0,
          firstVerifiedMs: null,
          failed: 0,
          timingValid: true,
        };
        // Frozen fictional requests authorize only proposals that pass structural and expected-target checks.
        // This is automated fixture approval, never public-document consent or model-quality evidence by itself.
        const artifacts = await page.evaluate(
          async ({ s, l, expected }) => {
            const w = window as unknown as {
              __agent: { editor: import("superdoc").SuperDoc };
            };
            const path = "/lib/agent/browser.ts";
            const { applyLane } = (await import(
              /* @vite-ignore */ path
            )) as typeof import("../lib/agent/browser");
            const allowed = s.blocks
              .filter((b) => expected.requiredTexts.includes(b.text))
              .map((b) => b.id);
            const approve =
              l.result?.plan.edits
                .filter((e) => allowed.includes(e.blockId))
                .map((e) => e.id) ?? [];
            if (approve.length)
              await applyLane(w.__agent.editor, s, l, approve);
            const blob = await w.__agent.editor.export({
              triggerDownload: false,
              commentsType: "external",
            });
            return {
              lane: l,
              bytes: blob
                ? [...new Uint8Array(await blob.arrayBuffer())]
                : null,
            };
          },
          { s, l, expected },
        );
        // Unexpected proposals are a failed outcome even when deliberately withheld from execution.
        const evaluation = evaluateLane(s, artifacts.lane, expected);
        if (
          result.plan.edits.some(
            (e) =>
              !s.blocks.some(
                (b) =>
                  b.id === e.blockId && expected.requiredTexts.includes(b.text),
              ),
          )
        )
          evaluation.agreement = false;
        artifacts.lane.expectedOutcome = evaluation.agreement;
        artifacts.lane.requiredCoverage = evaluation.coverage;
        const file = `outputs/agent-evaluation/${expected.id}-${rep + 1}-${p}.docx`;
        if (artifacts.bytes)
          await writeFile(file, Buffer.from(artifacts.bytes));
        report.runs.push({
          case: expected.id,
          repetition: rep + 1,
          lane: artifacts.lane,
          evaluation,
          export: artifacts.bytes ? file : undefined,
        });
        await persist();
        console.log(
          `${expected.id} ${rep + 1} ${p}: ${result.status}; context ${result.contextTokens}/${result.fullContextTokens}; ${artifacts.lane.executions.filter((e) => e.verified).length} edits; fixture ${evaluation.agreement}; $${(report.heldMicro / 1e6).toFixed(4)} cumulative`,
        );
      }
    }
  report.complete = report.runs.length >= 60;
  delete report.error;
  await persist();
} catch (e) {
  report.error = e instanceof Error ? e.message : "Evaluation stopped";
  await persist();
  console.error(report.error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
