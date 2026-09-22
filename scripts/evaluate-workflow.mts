/** Real browser document execution with the same provider adapters; no hosted-limit bypass. */
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { compareOne, reservationParts } from "../lib/server/comparison";
import { workflowHash } from "../lib/server/workflow";
import type { WorkflowInput } from "../lib/workflow/input";
import { MODELS, type CompareModel } from "../lib/compare/types";
import { equivalent, type WorkflowResult } from "../lib/workflow/types";
import { PRICING_DATE } from "../lib/compare/pricing";
import type * as BrowserWorkflow from "../lib/workflow/browser";
const fixtureFile = "fixtures/workflow/expected.json",
  raw = await readFile(fixtureFile, "utf8"),
  fixture = JSON.parse(raw);
const frozenCommit = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", fixtureFile],
  { encoding: "utf8" },
).trim();
if (
  !frozenCommit ||
  execFileSync("git", ["status", "--porcelain", "--", fixtureFile], {
    encoding: "utf8",
  }).trim()
)
  throw new Error("Commit the frozen workflow fixture first.");
if (!process.env.TYPESAFE_API_KEY || !process.env.OPENAI_API_KEY)
  throw new Error("Both provider keys are required.");
const out = process.env.WORKFLOW_OUTPUT || "docs/workflow-evaluation-v1.json";
await mkdir("outputs/workflow-evaluation", { recursive: true });
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
await page.addInitScript({ content: "window.__name = (fn) => fn;" });
const runs: { repetition: number; results: WorkflowResult[] }[] = [];
let heldMicro = 0;
const capMicro = 2000000;
const reservations = new Map<
  string,
  {
    snapshot: string;
    body: WorkflowInput;
    parts: Record<CompareModel, number>;
    claimed: Set<CompareModel>;
  }
>();
const report = () => ({
  dataset: fixture.dataset,
  fixtureHash: createHash("sha256").update(raw).digest("hex"),
  frozenCommit,
  documentHash: fixture.documentHash,
  pricingDate: PRICING_DATE,
  generatedAt: new Date().toISOString(),
  runtime: {
    browser: browser.version(),
    superdoc: "2.16.0",
    transport:
      "Local Playwright bridge to shared real provider adapters; bridge time included",
  },
  repetitionsRequested: 5,
  capUsd: 2,
  chargedOrHeldUsd: heldMicro / 1e6,
  complete: runs.length === 5,
  runs,
});
const persist = () => writeFile(out, JSON.stringify(report(), null, 2) + "\n");
await page.exposeFunction("workflowStart", async (body: WorkflowInput) => {
  const parts = reservationParts(body.input),
    amount = Object.values(parts).reduce((a, b) => a + b, 0);
  if (heldMicro + amount > capMicro)
    throw new Error("Stopped at the $2 local evaluation cap.");
  heldMicro += amount;
  const runId = crypto.randomUUID(),
    snapshot = await workflowHash(body);
  reservations.set(runId, { snapshot, body, parts, claimed: new Set() });
  await persist();
  return { runId, snapshot };
});
await page.exposeFunction(
  "workflowModel",
  async (body: WorkflowInput & { runId: string; model: CompareModel }) => {
    const r = reservations.get(body.runId);
    if (
      !r ||
      r.claimed.has(body.model) ||
      r.snapshot !== (await workflowHash(body))
    )
      throw new Error("Invalid evaluation slot.");
    r.claimed.add(body.model);
    const result = await compareOne(body.model, body.input, r.snapshot, {
      jev: process.env.TYPESAFE_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    });
    heldMicro +=
      (result.usage
        ? Math.ceil(result.usage.costUsd * 1e6)
        : r.parts[body.model]) - r.parts[body.model];
    await persist();
    console.log(
      `${body.model}: ${result.status}, ${Math.round(result.elapsedMs)}ms provider`,
    );
    return result;
  },
);
await page.exposeFunction("workflowFinish", async (runId: string) => {
  const r = reservations.get(runId);
  if (r) {
    for (const m of MODELS) if (!r.claimed.has(m)) heldMicro -= r.parts[m];
    reservations.delete(runId);
  }
  await persist();
});
await page.exposeFunction(
  "workflowArtifact",
  async (repetition: number, result: WorkflowResult, bytes: number[]) => {
    let run = runs.find((r) => r.repetition === repetition);
    if (!run) {
      run = { repetition, results: [] };
      runs.push(run);
    }
    run.results.push(result);
    await writeFile(
      `outputs/workflow-evaluation/${repetition}-${result.model}.docx`,
      Buffer.from(bytes),
    );
    await persist();
  },
);
try {
  await page.goto(process.env.DEMO_BASE_URL || "http://localhost:5173");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .waitFor();
  for (let repetition = 0; repetition < 5; repetition++) {
    await page.evaluate(
      async ({ fixture, repetition }) => {
        const modulePath = "/lib/workflow/browser.ts";
        const m = (await import(
          /* @vite-ignore */ modulePath
        )) as typeof BrowserWorkflow;
        const mount = document.createElement("div");
        mount.className = "workflow-runtime";
        document.body.appendChild(mount);
        type Bridge = typeof window & {
          workflowStart: BrowserWorkflow.WorkflowTransport["start"];
          workflowModel: BrowserWorkflow.WorkflowTransport["model"];
          workflowFinish: BrowserWorkflow.WorkflowTransport["finish"];
          workflowArtifact: (
            n: number,
            r: WorkflowResult,
            b: number[],
          ) => Promise<void>;
        };
        const w = window as Bridge;
        try {
          const f = await m.prepareWorkflow(mount);
          if (
            f.documentHash !== fixture.documentHash ||
            JSON.stringify(f.input) !== JSON.stringify(fixture.input) ||
            JSON.stringify(f.proposals) !== JSON.stringify(fixture.proposals)
          )
            throw new Error("Frozen sample or approved language changed.");
          await m.runWorkflow(mount, f, {
            safeguard: true,
            repetition,
            transport: {
              start: w.workflowStart,
              model: w.workflowModel,
              finish: w.workflowFinish,
            },
            onResult: async (a) => {
              await w.workflowArtifact(
                repetition + 1,
                a.result,
                a.blob ? [...new Uint8Array(await a.blob.arrayBuffer())] : [],
              );
            },
          });
        } finally {
          mount.remove();
        }
      },
      { fixture, repetition },
    );
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : "Evaluation failed");
} finally {
  await browser.close();
  await persist();
}
const distribution = (numbers: number[]) => {
  const v = numbers.toSorted((a, b) => a - b);
  return v.length
    ? {
        median:
          v.length % 2
            ? v[Math.floor(v.length / 2)]
            : (v[v.length / 2 - 1] + v[v.length / 2]) / 2,
        min: v[0],
        max: v.at(-1),
        mean: v.reduce((a, b) => a + b, 0) / v.length,
      }
    : null;
};
const summary = MODELS.map((model) => {
  const results = runs.flatMap((r) =>
    r.results.filter((x) => x.model === model),
  );
  return {
    model,
    requests: results.length,
    complete: results.filter((r) => r.status === "complete").length,
    expectedOutcomes: results.filter((r) => r.expectedOutcome).length,
    timingValid: results.filter((r) => r.timingValid).length,
    activeMs: distribution(
      results
        .filter((r) => r.timingValid && r.status === "complete")
        .map((r) => r.timing.activeMs),
    ),
    decisionMs: distribution(
      results
        .filter((r) => r.status === "complete")
        .map((r) => r.timing.decisionMs),
    ),
    estimatedCostUsd: distribution(
      results.flatMap((r) =>
        r.comparison.usage ? [r.comparison.usage.costUsd] : [],
      ),
    ),
    unknownCosts: results.filter((r) => !r.comparison.usage).length,
    equivalentToJev: runs.filter((r) =>
      equivalent(
        r.results.find((x) => x.model === MODELS[0]),
        r.results.find((x) => x.model === model),
      ),
    ).length,
  };
});
const final = {
  ...report(),
  complete: runs.length === 5 && runs.every((r) => r.results.length === 3),
  summary,
};
await writeFile(out, JSON.stringify(final, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
