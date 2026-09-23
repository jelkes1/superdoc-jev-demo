import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runPipeline, reservationSlots } from "../lib/agent/pipeline";
import {
  AGENT_VERSION,
  REGISTRY_VERSION,
  PIPELINES,
  type Snapshot,
} from "../lib/agent/types";
const fixture = JSON.parse(
  await readFile("fixtures/agent/held-out.json", "utf8"),
);
const commit = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", "fixtures/agent/held-out.json"],
  { encoding: "utf8" },
).trim();
if (
  execFileSync(
    "git",
    ["status", "--porcelain", "--", "fixtures/agent/held-out.json"],
    { encoding: "utf8" },
  ).trim()
)
  throw new Error("Freeze first");
const base = JSON.parse(
  await readFile("docs/agent-evaluation-v1.json", "utf8"),
);
const path = "docs/agent-held-out-v1.json";
let report = {
  version: fixture.version,
  frozenCommit: commit,
  heldMicro: base.heldMicro,
  capUsd: 2,
  runs: [] as unknown[],
  complete: false,
};
try {
  report = JSON.parse(await readFile(path, "utf8"));
} catch {}
const save = () => writeFile(path, JSON.stringify(report, null, 2) + "\n");
for (const c of fixture.cases)
  for (const p of PIPELINES) {
    if (report.runs.some((r: any) => r.case === c.id && r.pipeline === p))
      continue;
    const s: Snapshot = {
      version: AGENT_VERSION,
      registryVersion: REGISTRY_VERSION,
      documentHash: createHash("sha256")
        .update(JSON.stringify(c.passages))
        .digest("hex"),
      revision: "held-out-1",
      request: c.request,
      warnings: [],
      blocks: c.passages.map(([title, text]: string[], i: number) => ({
        id: `p${i}`,
        nodeId: `node-${i}`,
        nodeType: "paragraph",
        text,
        title,
        section: title,
        ordinal: i,
        table: null,
        dependencies: c.passages.flatMap(([t]: string[], j: number) =>
          /definition/i.test(t) && i !== j ? [`p${j}`] : [],
        ),
        unresolvedRefs: [],
        existingRevisions: [],
      })),
    };
    const parts = reservationSlots(s, [p]),
      maximum = Object.values(parts).reduce((a, b) => a + b, 0);
    if (report.heldMicro + maximum > 2e6)
      throw new Error("Local $2 cap reached");
    report.heldMicro += maximum;
    await save();
    const claimed = new Set<string>(),
      t = performance.now();
    const result = await runPipeline(
      s,
      p,
      s.documentHash,
      { jev: process.env.TYPESAFE_API_KEY, openai: process.env.OPENAI_API_KEY },
      () => {},
      {
        async start(slot) {
          claimed.add(slot);
        },
        async finish(slot, cost) {
          if (cost !== null) report.heldMicro += cost - parts[slot];
          await save();
        },
      },
    );
    for (const slot of Object.keys(parts))
      if (!claimed.has(slot)) report.heldMicro -= parts[slot];
    const coverage =
      c.required.filter((i: number) => result.selection.ids.includes(`p${i}`))
        .length / c.required.length;
    const ids = result.plan.edits.map((e) => Number(e.blockId.slice(1)));
    const agreement =
      result.status === "complete" &&
      (c.outcome === "clarification"
        ? !!result.plan.clarification && !ids.length
        : c.outcome === "unresolved"
          ? !ids.length &&
            (!!result.plan.clarification || !!result.plan.unresolved.length)
          : c.permitted.every((i: number) => ids.includes(i)) &&
            ids.every((i) => c.permitted.includes(i)) &&
            result.plan.edits.every((e) =>
              c.id === "reordered"
                ? /60/.test(e.replacement)
                : /written.*(?:consent|permission|authori)/i.test(
                    e.replacement,
                  ),
            ));
    report.runs.push({
      case: c.id,
      pipeline: p,
      elapsedMs: performance.now() - t,
      coverage,
      agreement,
      result,
    });
    await save();
    console.log(`${c.id} ${p}: ${agreement} coverage ${coverage}`);
  }
report.complete = report.runs.length === 20;
await save();
console.log(
  `Cumulative pilot + formal + held-out reservation-adjusted spend $${(report.heldMicro / 1e6).toFixed(5)}`,
);
