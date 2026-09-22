import test from "node:test";
import assert from "node:assert/strict";
import {
  reduction,
  equivalent,
  savings,
  rotatedModels,
  type WorkflowResult,
} from "../lib/workflow/types";
import { MODELS } from "../lib/compare/types";
const valid = (
  model: (typeof MODELS)[number],
  ms = 100,
  cost: number | null = 0.001,
) =>
  ({
    model,
    snapshot: "same",
    documentHash: "same",
    version: "v1",
    safeguard: true,
    status: "complete",
    expectedOutcome: true,
    preserved: true,
    failed: 0,
    operations: [{ verified: true }],
    outcome: "same output",
    timing: { activeMs: ms },
    timingValid: true,
    comparison: { usage: cost === null ? null : { costUsd: cost } },
  }) as WorkflowResult;
test("ROI uses unrounded absolute and percentage differences, including losses and unknowns", () => {
  assert.deepEqual(reduction(100, 25), { absolute: 75, percent: 75 });
  assert.deepEqual(reduction(100, 125), { absolute: -25, percent: -25 });
  assert.equal(reduction(0, 0), null);
  assert.equal(reduction(null, 2), null);
  assert.equal(reduction(1, NaN), null);
  const j = valid(MODELS[0], 120, 0.002),
    b = valid(MODELS[1], 100, 0.001);
  assert.equal(savings(j, b).cost!.percent, -100);
  assert.equal(savings(j, b).time!.percent, -20);
  assert.equal(savings(valid(MODELS[0], 10, null), b).cost, null);
});
test("same counts do not prove equivalent outputs; incomplete, stale, zero and hidden runs cannot claim savings", () => {
  const j = valid(MODELS[0]),
    b = valid(MODELS[1]);
  assert.ok(equivalent(j, b));
  for (const patch of [
    { outcome: "different text" },
    { snapshot: "changed" },
    { documentHash: "changed" },
    { safeguard: false },
    { failed: 1 },
    { operations: [] },
    { preserved: false },
    { expectedOutcome: false },
    { status: "incomplete" },
  ])
    assert.equal(equivalent(j, { ...b, ...patch } as WorkflowResult), false);
  assert.equal(savings(j, { ...b, timingValid: false }).time, null);
  assert.ok(savings(j, { ...b, timingValid: false }).cost);
  assert.deepEqual(rotatedModels(MODELS, 1), [MODELS[1], MODELS[2], MODELS[0]]);
});
