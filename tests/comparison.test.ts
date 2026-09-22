import test from "node:test";
import assert from "node:assert/strict";
import { canonicalTask, deskSchema } from "../lib/compare/input";
import { DEFAULT_POLICY, VERSION } from "../lib/deal-desk/rules";
import {
  MODELS,
  disagreements,
  type CompareResult,
} from "../lib/compare/types";
import { pricedUsage } from "../lib/compare/pricing";
import {
  jevPayload,
  openaiPayload,
  parseVerdicts,
  snapshotId,
  reservationParts,
  reconciledCharge,
  compareOne,
} from "../lib/server/comparison";
import { RunMeasurements } from "../lib/deal-desk/measurements";
import type { Operation } from "../lib/deal-desk/document";
const input = deskSchema.parse({
  revision: "1",
  version: VERSION,
  policy: DEFAULT_POLICY,
  rows: [
    {
      id: "training",
      text: "Training allowed.",
      context: "Fictional evidence",
    },
    { id: "renewal", text: "15 days", context: "Fictional evidence" },
  ],
});
test("identical evidence, questions and choices; exact snapshots; no fake confidence", async () => {
  const task = canonicalTask(input),
    jev = jevPayload(input);
  for (const model of MODELS.slice(1)) {
    const req = openaiPayload(input, model as (typeof MODELS)[1]);
    assert.deepEqual(JSON.parse(req.messages[1].content), task);
    assert.deepEqual(jev.state, task.evidence);
    assert.equal(req.reasoning_effort, "none");
    assert.equal(req.model, model);
  }
  assert.equal(
    await snapshotId(input),
    await snapshotId(structuredClone(input)),
  );
  assert.notEqual(
    await snapshotId(input),
    await snapshotId({ ...input, revision: "2" }),
  );
  assert.equal(
    deskSchema.safeParse({ ...input, rows: [input.rows[0], input.rows[0]] })
      .success,
    false,
  );
  const valid = parseVerdicts(
    {
      verdicts: [
        { id: "training", verdict: "UNACCEPTABLE" },
        { id: "renewal", verdict: "NEEDS_REVIEW" },
      ],
    },
    input,
  );
  assert.equal(valid.complete, true);
  assert.equal("confidence" in valid.verdicts[0], false);
});
test("missing, duplicate and extra answers stay incomplete; disagreements only compare returned labels", () => {
  for (const answers of [
    [],
    [{ id: "training", verdict: "ACCEPTABLE" }],
    [
      { id: "training", verdict: "ACCEPTABLE" },
      { id: "training", verdict: "UNACCEPTABLE" },
    ],
  ])
    assert.equal(parseVerdicts({ verdicts: answers }, input).complete, false);
  const result = (
    model: (typeof MODELS)[number],
    verdict: "ACCEPTABLE" | "NEEDS_REVIEW",
  ): CompareResult => ({
    model,
    snapshot: "s",
    elapsedMs: 1,
    status: "complete",
    usage: null,
    verdicts: [{ id: "training", verdict }],
  });
  assert.deepEqual(
    disagreements([
      result(MODELS[0], "ACCEPTABLE"),
      result(MODELS[1], "NEEDS_REVIEW"),
    ]),
    ["training"],
  );
});
test("cached pricing and unknown usage reservation; unavailable model is never substituted", async () => {
  const usage = pricedUsage(MODELS[2], 1000, 20, 800);
  assert.equal(usage.costUsd, (200 * 2.5 + 800 * 0.25 + 20 * 15) / 1e6);
  assert.throws(() => pricedUsage(MODELS[1], 10, 0, 11));
  const parts = reservationParts(input);
  assert.equal(
    reconciledCharge([], parts),
    Object.values(parts).reduce((a, b) => a + b),
  );
  const unavailable = await compareOne(MODELS[1], input, "frozen", {});
  assert.equal(unavailable.model, MODELS[1]);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.usage?.costUsd, 0);
  assert.equal(
    reconciledCharge([unavailable], parts),
    parts[MODELS[0]] + parts[MODELS[2]],
  );
});
test("active processing excludes human pauses, includes first verification and accumulates usage once", () => {
  let now = 0;
  const m = new RunMeasurements(() => now);
  m.begin("review", "rev1", "p1");
  now = 100;
  m.usage(
    "jev",
    {
      inputTokens: 10,
      outputTokens: 1,
      costUsd: 0.000001,
      latencyMs: 80,
      decisions: 2,
    },
    "rev1",
    "p1",
  );
  m.end();
  now = 60100;
  m.begin("superdoc", "rev1", "p1");
  m.attempt();
  now = 60125;
  m.operation({
    id: "training",
    verified: true,
    preserved: true,
    changeIds: ["a", "b", "c"],
    commentId: "comment",
    beforeRevision: "rev1",
    afterRevision: "rev2",
  } as Operation);
  now = 60150;
  m.end();
  assert.equal(m.snapshot().activeMs, 150);
  assert.equal(m.snapshot().firstVerifiedMs, 125);
  assert.equal(m.snapshot().verified, 1);
  m.begin("reasoning", "rev2", "p1");
  assert.throws(() => m.begin("review", "rev2", "p1"));
  now += 10;
  m.unknown();
  m.end();
  m.attempt();
  m.operation();
  assert.equal(m.snapshot().failed, 1);
  assert.equal(m.snapshot().unknownCalls, 1);
  assert.equal(m.snapshot().usage.length, 1);
});
