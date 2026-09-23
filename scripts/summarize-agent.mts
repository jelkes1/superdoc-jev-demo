import { readFile, writeFile } from "node:fs/promises";
const raw = JSON.parse(await readFile("docs/agent-evaluation-v1.json", "utf8")),
  held = JSON.parse(await readFile("docs/agent-held-out-v1.json", "utf8"));
const median = (xs: number[]) => {
  const a = [...xs].sort((a, b) => a - b);
  return a.length % 2
    ? a[(a.length - 1) / 2]
    : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const stat = (a: number[]) => ({
  median: median(a),
  min: Math.min(...a),
  max: Math.max(...a),
  mean: a.reduce((a, b) => a + b, 0) / a.length,
});
const rows = [];
for (const task of ["renewal", "training", "names"])
  for (const pipeline of ["full", "keyword", "jev", "interpret"]) {
    const rs = raw.runs.filter(
        (r: any) => r.case === task && r.lane.pipeline === pipeline,
      ),
      ls = rs.map((r: any) => r.lane),
      costs = ls
        .filter((l: any) => !l.result.unknownUsage)
        .map((l: any) =>
          l.result.usage.reduce((n: number, u: any) => n + u.costUsd, 0),
        );
    rows.push({
      task,
      pipeline,
      runs: rs.length,
      agreement: rs.filter((r: any) => r.evaluation.agreement).length,
      failed: ls.filter((l: any) => l.result.status === "failed" || l.failed)
        .length,
      verifiedEdits: ls.reduce(
        (n: number, l: any) =>
          n +
          l.executions.filter(
            (e: any) => e.verified && e.edit.tool === "replace",
          ).length,
        0,
      ),
      latency: stat(
        ls.map((l: any) => l.extractionMs + l.planningMs + l.executionMs),
      ),
      firstEdit: ls.some((l: any) => l.firstVerifiedMs !== null)
        ? stat(
            ls
              .filter((l: any) => l.firstVerifiedMs !== null)
              .map((l: any) => l.firstVerifiedMs),
          )
        : null,
      cost: costs.length ? stat(costs) : null,
      unknownCost: ls.length - costs.length,
      context: stat(ls.map((l: any) => l.result.contextTokens)),
      fallbacks: ls.filter((l: any) => l.result.selection.fallback).length,
      missedContext: rs.reduce(
        (n: number, r: any) =>
          n +
          (1 - r.evaluation.coverage) *
            (task === "training" ? 4 : task === "renewal" ? 2 : 0),
        0,
      ),
      schemaTokens: stat(ls.map((l: any) => l.result.toolTokens)),
      cachedTokens: ls.reduce(
        (n: number, l: any) =>
          n +
          l.result.usage.reduce(
            (m: number, u: any) => m + u.cachedInputTokens,
            0,
          ),
        0,
      ),
    });
  }
const summary = {
  version: "agent-evaluation-v1",
  documentHash: raw.documentHash,
  frozenCommit: raw.frozenCommit,
  runs: raw.runs.length,
  complete: raw.complete,
  localSpendBoundUsd: held.heldMicro / 1e6,
  formalReportedUsd: raw.runs.reduce(
    (n: number, r: any) =>
      n + r.lane.result.usage.reduce((m: number, u: any) => m + u.costUsd, 0),
    0,
  ),
  rows,
  heldOut: held.runs.map((r: any) => ({
    case: r.case,
    pipeline: r.pipeline,
    coverage: r.coverage,
    agreement: r.agreement,
  })),
  failures: raw.runs
    .filter((r: any) => r.lane.result.status === "failed")
    .map((r: any) => ({
      case: r.case,
      repetition: r.repetition,
      pipeline: r.lane.pipeline,
      error: r.lane.result.error,
    })),
};
await writeFile(
  "docs/agent-summary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary, null, 2));
