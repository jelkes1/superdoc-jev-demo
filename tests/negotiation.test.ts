import test from "node:test";
import assert from "node:assert/strict";
import { replacement, findLocations } from "../lib/negotiation/scenario";
import {
  canPropose,
  isAligned,
  type ConnectedEdit,
} from "../lib/negotiation/document";
const clause = {
  id: "a",
  nodeId: "a",
  nodeType: "paragraph" as const,
  title: "Liability",
  text: "General cap: 18 months of fees. Data-protection cap: 36 months of fees. See Section 6.1 and Schedule B.",
  context: "",
  ordinal: 1,
  incomplete: false,
};
const decision = {
  locationId: "order" as const,
  verdict: "UNACCEPTABLE" as const,
  confidence: 0.95,
  probabilities: {
    ACCEPTABLE: 0,
    UNACCEPTABLE: 1,
    NEEDS_REVIEW: 0,
    NOT_APPLICABLE: 0,
  },
  model: "test-only",
};
const edit: ConnectedEdit = {
  id: "order",
  label: "Order form",
  reference: "table",
  clause,
  replacement: replacement("order", clause.text, { general: 12, data: 24 }),
  existing: [],
  decision,
};
test("connected proposals require confidence, complete targets, and no overlap", () => {
  assert.equal(canPropose(edit), true);
  assert.equal(
    canPropose({ ...edit, decision: { ...decision, confidence: 0.9499 } }),
    false,
  );
  assert.equal(
    canPropose({
      ...edit,
      decision: { ...decision, verdict: "NEEDS_REVIEW", confidence: 1 },
    }),
    false,
  );
  assert.equal(canPropose({ ...edit, problem: "Missing context" }), false);
  assert.equal(canPropose({ ...edit, clause: undefined }), false);
  assert.equal(
    canPropose({ ...edit, clause: { ...clause, incomplete: true } }),
    false,
  );
  assert.equal(
    isAligned({
      ...edit,
      replacement: clause.text,
      decision: { ...decision, verdict: "NEEDS_REVIEW", confidence: 1 },
    }),
    false,
  );
  assert.equal(
    isAligned({
      ...edit,
      replacement: clause.text,
      decision: { ...decision, verdict: "ACCEPTABLE", confidence: 1 },
    }),
    true,
  );
  assert.equal(
    canPropose({
      ...edit,
      decision: { ...decision, verdict: "NEEDS_REVIEW" },
      humanApproved: true,
    }),
    true,
  );
});
test("fallbacks preserve extra human text and reject unsupported or duplicate phrases", () => {
  const p = { general: 12 as const, data: 24 as const };
  assert.equal(
    replacement("order", clause.text + " Agreed by both parties.", p),
    edit.replacement + " Agreed by both parties.",
  );
  assert.equal(
    replacement("order", clause.text.replace("18 months", "unlimited"), p),
    null,
  );
  assert.equal(
    replacement("order", clause.text + " General cap: 18 months of fees.", p),
    null,
  );
  assert.equal(
    findLocations([clause, { ...clause, id: "b", nodeId: "b" }]).find(
      (e) => e.id === "order",
    )?.problem,
    "More than one matching location. Review manually.",
  );
});
