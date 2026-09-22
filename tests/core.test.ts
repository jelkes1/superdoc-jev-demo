import test from "node:test";
import assert from "node:assert/strict";
import { playbook, deterministicProposal } from "../lib/review/playbook";
import { routeDecision } from "../lib/review/routing";
import { answerSchema, readJson } from "../lib/server/validation";
import { batches, estimatedJevCost, evaluateBatch } from "../lib/server/jev";
import { reasonToken, sameToken } from "../lib/server/tokens";
import { readReview } from "../lib/review/stream";
import type { Clause, Decision } from "../lib/review/types";
const clause: Clause = {
  id: "p1",
  nodeId: "p1",
  nodeType: "paragraph",
  title: "Payment",
  ordinal: 0,
  context: "Payment section",
  incomplete: false,
  text: "Customer shall pay each undisputed invoice within 45 days after receipt.",
};
const decision: Decision = {
  id: "p1:payment",
  clauseId: "p1",
  ruleId: "payment",
  verdict: "UNACCEPTABLE",
  confidence: 0.95,
  probabilities: {
    ACCEPTABLE: 0.01,
    UNACCEPTABLE: 0.95,
    NEEDS_REVIEW: 0.03,
    NOT_APPLICABLE: 0.01,
  },
  revision: "0",
  playbookVersion: playbook().version,
  model: "jev-1.13.0",
};
test("confidence boundaries, ambiguous and acceptable routing", () => {
  assert.equal(routeDecision(decision, clause, playbook()), "propose");
  assert.equal(
    routeDecision({ ...decision, confidence: 0.9499 }, clause, playbook()),
    "human",
  );
  assert.equal(
    routeDecision({ ...decision, confidence: 0.7 }, clause, playbook()),
    "human",
  );
  assert.equal(
    routeDecision({ ...decision, confidence: 0.6999 }, clause, playbook()),
    "reason",
  );
  assert.equal(
    routeDecision(
      { ...decision, verdict: "NEEDS_REVIEW", confidence: 1 },
      clause,
      playbook(),
    ),
    "reason",
  );
  assert.equal(
    routeDecision({ ...decision, verdict: "ACCEPTABLE" }, clause, playbook()),
    "unchanged",
  );
  assert.equal(
    routeDecision(
      { ...decision, verdict: "NOT_APPLICABLE" },
      clause,
      playbook(),
    ),
    "irrelevant",
  );
  assert.equal(
    routeDecision(decision, { ...clause, incomplete: true }, playbook()),
    "human",
  );
  assert.equal(
    routeDecision(
      decision,
      { ...clause, text: "Payment varies by statement of work." },
      playbook(),
    ),
    "reason",
  );
});
test("predefined proposals apply only to exact supported patterns", () => {
  assert.match(
    deterministicProposal(clause, "payment", playbook())!.replacement,
    /30 days/,
  );
  assert.equal(
    deterministicProposal(
      { ...clause, text: clause.text + " Except disputed amounts." },
      "payment",
      playbook(),
    ),
    null,
  );
  assert.equal(
    deterministicProposal(
      { ...clause, text: clause.text.replace("45", "30") },
      "payment",
      playbook(),
    ),
    null,
  );
});
test("full distribution required, confidence preserved independently", () => {
  const a = answerSchema.parse({
    type: "choice",
    choice: "UNACCEPTABLE",
    confidence: 0.81,
    probabilities: decision.probabilities,
  });
  assert.equal(a.confidence, 0.81);
  assert.throws(() =>
    answerSchema.parse({
      type: "choice",
      choice: "UNACCEPTABLE",
      confidence: 0.95,
      probabilities: { UNACCEPTABLE: 1 },
    }),
  );
});
test("batches retain clauses and model, conservative reservation", () => {
  const input = {
    clauses: Array.from({ length: 11 }, (_, i) => ({
      ...clause,
      id: `p${i}`,
      nodeId: `p${i}`,
      ordinal: i,
    })),
    revision: "0",
    playbook: playbook(),
  };
  const b = batches(input);
  assert.equal(b.length, 3);
  assert.equal(b.flatMap((x) => x.clauses).length, 11);
  assert.equal(Object.keys(b[0].request.questions).length, 20);
  assert.ok(estimatedJevCost(b) > 0);
});
test("reasoning authorization bound to review, context and playbook", async () => {
  const a = await reasonToken(
    "secret",
    "review1",
    clause,
    "payment",
    playbook(),
  );
  assert.ok(
    sameToken(
      a,
      await reasonToken("secret", "review1", clause, "payment", playbook()),
    ),
  );
  assert.ok(
    !sameToken(
      a,
      await reasonToken("secret", "review2", clause, "payment", playbook()),
    ),
  );
  assert.ok(
    !sameToken(
      a,
      await reasonToken(
        "secret",
        "review1",
        { ...clause, text: "altered" },
        "payment",
        playbook(),
      ),
    ),
  );
});
test("cross-origin and oversized input rejected", async () => {
  await assert.rejects(
    readJson(
      new Request("https://demo.test/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.test",
        },
        body: "{}",
      }),
    ),
    /Cross-origin/,
  );
  await assert.rejects(
    readJson(
      new Request("https://demo.test/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(1800001),
      }),
    ),
    /too large/,
  );
});
test("provider error or truncated stream never counts as completed", async () => {
  const events: unknown[] = [];
  await assert.rejects(
    readReview(
      new Response('{"type":"start","reviewId":"x","total":5,"model":"jev"}\n'),
      (e) => events.push(e),
    ),
    /interrupted/,
  );
  await assert.rejects(
    readReview(
      new Response('{"type":"error","message":"Provider failed"}\n'),
      () => {},
    ),
    /Provider failed/,
  );
  await readReview(
    new Response('{"type":"complete","usage":{},"missingRules":[]}\n'),
    () => {},
  );
});
test("Jev failures are propagated without retry or fabricated decisions", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("{}", { status: 503 });
  };
  try {
    const input = { clauses: [clause], revision: "0", playbook: playbook() };
    await assert.rejects(evaluateBatch("test-only", batches(input)[0], input));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previous;
  }
});

test("template guard rejects a model finding that contradicts the explicit numeric policy", () => {
  assert.equal(
    deterministicProposal(
      { ...clause, text: clause.text.replace("45", "15") },
      "payment",
      playbook(),
    ),
    null,
  );
  const liability = {
    ...clause,
    text: "Each party’s aggregate liability arising out of or relating to this agreement shall not exceed the fees paid or payable under this agreement during the 18 months preceding the event giving rise to the claim.",
  };
  assert.equal(
    deterministicProposal(liability, "liability", playbook(24)),
    null,
  );
  assert.match(
    deterministicProposal(liability, "liability", playbook(12))!.replacement,
    /12 months/,
  );
  const renewal = {
    ...clause,
    text: "The subscription automatically renews for successive twelve-month terms unless either party gives written notice of non-renewal at least 45 days before the end of the then-current term.",
  };
  assert.equal(deterministicProposal(renewal, "renewal", playbook()), null);
});
