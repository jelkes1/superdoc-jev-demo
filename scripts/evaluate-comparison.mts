import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  MODELS,
  disagreements,
  type CompareResult,
} from "../lib/compare/types";
import { deskSchema } from "../lib/compare/input";
import { VERSION } from "../lib/deal-desk/rules";
import {
  snapshotId,
  reservationParts,
  compareOne,
  reconciledCharge,
  COMPARISON_SETTINGS,
} from "../lib/server/comparison";
import { PRICING_DATE } from "../lib/compare/pricing";
const file = "fixtures/comparison/expected.json";
const raw = await readFile(file, "utf8");
const fixture = JSON.parse(raw) as {
  dataset: string;
  policy: unknown;
  variants: {
    id: string;
    rows: { id: string; text: string; expected: string; rationale: string }[];
  }[];
};
const fixtureHash = createHash("sha256").update(raw).digest("hex");
const frozenCommit = execFileSync(
  "git",
  ["log", "-1", "--format=%H", "--", file],
  { encoding: "utf8" },
).trim();
if (
  !frozenCommit ||
  execFileSync("git", ["status", "--porcelain", "--", file], {
    encoding: "utf8",
  }).trim()
)
  throw new Error("Commit the expected fixture before running.");
if (!process.env.TYPESAFE_API_KEY || !process.env.OPENAI_API_KEY)
  throw new Error("Both configured credentials are required.");
const out = process.env.EVAL_OUTPUT || "docs/evaluation-v4.json";
const runs: {
  variant: string;
  repetition: number;
  snapshot: string;
  results: CompareResult[];
  disagreements: string[];
}[] = [];
let reservedOrSpentMicro = 0;
const capMicro = 2e6;
const report = () => ({
  dataset: fixture.dataset,
  fixtureHash,
  frozenCommit,
  pricingDate: PRICING_DATE,
  settings: COMPARISON_SETTINGS,
  models: MODELS,
  repetitionsRequested: 5,
  variantsRequested: 4,
  capUsd: 2,
  chargedOrHeldUsd: reservedOrSpentMicro / 1e6,
  complete: runs.length === 20,
  generatedAt: new Date().toISOString(),
  runs,
});
await mkdir("docs", { recursive: true });
await writeFile(out, JSON.stringify(report(), null, 2) + "\n");
for (let repetition = 1; repetition <= 5; repetition++) {
  for (const variant of fixture.variants) {
    const input = deskSchema.parse({
      revision: `${fixture.dataset}:${variant.id}`,
      version: VERSION,
      policy: fixture.policy,
      rows: variant.rows.map(({ id, text }) => ({
        id,
        text,
        context: `Fictional evaluation. Complete evidence for this location:\n${text}`,
      })),
    });
    const snapshot = await snapshotId(input),
      parts = reservationParts(input),
      maximum = Object.values(parts).reduce((a, b) => a + b, 0);
    if (reservedOrSpentMicro + maximum > capMicro) {
      console.log(
        "Stopped before next provider calls: $2 cap. Partial results retained.",
      );
      await writeFile(out, JSON.stringify(report(), null, 2) + "\n");
      process.exit(0);
    }
    reservedOrSpentMicro += maximum;
    await writeFile(out, JSON.stringify(report(), null, 2) + "\n");
    const results = await Promise.all(
      MODELS.map((model) =>
        compareOne(model, input, snapshot, {
          jev: process.env.TYPESAFE_API_KEY,
          openai: process.env.OPENAI_API_KEY,
        }),
      ),
    );
    reservedOrSpentMicro += reconciledCharge(results, parts) - maximum;
    runs.push({
      variant: variant.id,
      repetition,
      snapshot,
      results,
      disagreements: disagreements(results),
    });
    await writeFile(out, JSON.stringify(report(), null, 2) + "\n");
    console.log(
      `${variant.id} ${repetition}/5: ${results.map((r) => `${r.model} ${r.status}`).join(" | ")}; charged/held $${(reservedOrSpentMicro / 1e6).toFixed(4)}`,
    );
  }
}
const distribution = (values: number[]) => {
  const s = values.toSorted((a, b) => a - b);
  return s.length
    ? {
        median:
          s.length % 2
            ? s[Math.floor(s.length / 2)]
            : (s[s.length / 2 - 1] + s[s.length / 2]) / 2,
        min: s[0],
        max: s.at(-1),
      }
    : null;
};
const summary = MODELS.map((model) => {
  const all = runs.map((run) => ({
    run,
    result: run.results.find((r) => r.model === model)!,
  }));
  let agreement = 0,
    returned = 0,
    expectedCount = 0,
    missedViolations = 0,
    unresolvedAsAcceptable = 0;
  for (const { run, result } of all)
    for (const row of fixture.variants.find((v) => v.id === run.variant)!
      .rows) {
      expectedCount++;
      const actual = result.verdicts.find((v) => v.id === row.id)?.verdict;
      if (actual) returned++;
      if (actual === row.expected) agreement++;
      if (row.expected === "UNACCEPTABLE" && actual !== "UNACCEPTABLE")
        missedViolations++;
      if (row.expected === "NEEDS_REVIEW" && actual === "ACCEPTABLE")
        unresolvedAsAcceptable++;
    }
  return {
    model,
    requests: all.length,
    failuresOrIncomplete: all.filter((x) => x.result.status !== "complete")
      .length,
    latencyMs: distribution(all.map((x) => x.result.elapsedMs)),
    estimatedCostUsd: distribution(
      all.flatMap((x) => (x.result.usage ? [x.result.usage.costUsd] : [])),
    ),
    totalReportedCostUsd: all.reduce(
      (n, x) => n + (x.result.usage?.costUsd ?? 0),
      0,
    ),
    unknownUsageRequests: all.filter((x) => !x.result.usage).length,
    fixtureAgreement: { matches: agreement, expected: expectedCount, returned },
    missedViolations,
    unresolvedAsAcceptable,
  };
});
await writeFile(out, JSON.stringify({ ...report(), summary }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
