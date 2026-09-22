import { test } from "node:test";
import assert from "node:assert/strict";
import { eligible, signature, type Row } from "../lib/deal-desk/document";
import {
  RULES,
  DEFAULT_POLICY,
  proposedText,
  type Decision,
} from "../lib/deal-desk/rules";
const clause = {
  id: "a",
  nodeId: "a",
  nodeType: "paragraph" as const,
  text: "before",
  context: "nearby",
  title: "Test",
  ordinal: 1,
  incomplete: false,
};
const row: Row = {
  id: "training",
  clause,
  context: "nearby",
  replacement: "after",
  existing: [],
};
const d: Decision = {
  id: "training",
  verdict: "UNACCEPTABLE",
  confidence: 0.95,
  probabilities: {
    ACCEPTABLE: 0,
    UNACCEPTABLE: 0.95,
    NEEDS_REVIEW: 0.05,
    NOT_APPLICABLE: 0,
  },
  model: "test",
};
test("deal desk gates confidence, uncertainty, structural inserts and overlapping revisions", () => {
  assert.equal(eligible(row, d), true);
  assert.equal(eligible(row, { ...d, confidence: 0.949 }), false);
  assert.equal(
    eligible(row, { ...d, verdict: "NEEDS_REVIEW", confidence: 1 }),
    false,
  );
  assert.equal(eligible({ ...row, existing: ["counsel"] }, d), false);
  assert.equal(eligible({ ...row, id: "safeguard" }, d), false);
  assert.equal(eligible({ ...row, problem: "Missing context" }, d), false);
});
test("changed context and policy invalidate cached judgments; unrelated text cannot be overwritten by a template", () => {
  assert.notEqual(
    signature(row, DEFAULT_POLICY),
    signature({ ...row, context: "new evidence" }, DEFAULT_POLICY),
  );
  assert.notEqual(
    signature(row, DEFAULT_POLICY),
    signature(row, { ...DEFAULT_POLICY, notice: 60 }),
  );
  assert.equal(
    proposedText(
      RULES[0],
      "Provider may use Customer Data to train something else. Keep this concession.",
      DEFAULT_POLICY,
    ),
    null,
  );
  assert.equal(
    proposedText(
      RULES[1],
      "Model training permitted by default. Preserve this added exception.",
      DEFAULT_POLICY,
    ),
    null,
  );
  assert.equal(
    proposedText(
      RULES[3],
      "Non-renewal notice: 15 days. Extra terms.",
      DEFAULT_POLICY,
    ),
    null,
  );
});
