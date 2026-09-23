import test from "node:test";
import assert from "node:assert/strict";
import {
  assemble,
  fromDecisions,
  keywordSelection,
  validatePlan,
  validateSnapshot,
} from "../lib/agent/selection";
import { reservationSlots } from "../lib/agent/pipeline";
import {
  AGENT_VERSION,
  REGISTRY_VERSION,
  PIPELINES,
  savings,
  type Snapshot,
  type SelectionDecision,
  type DraftPlan,
} from "../lib/agent/types";
const sample = (): Snapshot => ({
  version: AGENT_VERSION,
  registryVersion: REGISTRY_VERSION,
  documentHash: "a".repeat(64),
  revision: "1",
  request: "Require written consent for training",
  warnings: [],
  blocks: [
    {
      id: "a",
      nodeId: "na",
      nodeType: "paragraph",
      text: "Provider may train models using Customer Data.",
      title: "Data use",
      section: "Data",
      ordinal: 0,
      table: null,
      dependencies: ["b"],
      unresolvedRefs: [],
      existingRevisions: [],
    },
    {
      id: "b",
      nodeId: "nb",
      nodeType: "paragraph",
      text: "Customer Data includes de-identified excerpts.",
      title: "Definitions",
      section: "Definitions",
      ordinal: 1,
      table: null,
      dependencies: [],
      unresolvedRefs: [],
      existingRevisions: [],
    },
    {
      id: "c",
      nodeId: "nc",
      nodeType: "paragraph",
      text: "Invoices are payable within thirty days.",
      title: "Payment",
      section: "Payment",
      ordinal: 2,
      table: null,
      dependencies: [],
      unresolvedRefs: [],
      existingRevisions: ["counsel"],
    },
  ],
});
test("context exclusion boundary retains uncertain evidence and follows definitions", () => {
  const s = sample(),
    ds: SelectionDecision[] = [
      "a",
      "b",
      "c",
      "tool:replace",
      "tool:comment",
    ].map((id) => ({
      id,
      verdict: "IRRELEVANT",
      confidence: 0.95,
      probabilities: { IRRELEVANT: 0.95, RELEVANT: 0.03, UNCERTAIN: 0.02 },
    }));
  ds[0].confidence = 0.9499;
  assert.deepEqual(fromDecisions(s, ds).ids, ["a", "b"]);
  ds[2].verdict = "UNCERTAIN";
  assert.deepEqual(fromDecisions(s, ds).ids, ["a", "b", "c"]);
  assert.throws(() => fromDecisions(s, ds.slice(1)), /Missing/);
  assert.throws(() => fromDecisions(s, [...ds, ds[0]]), /duplicate/);
  s.blocks[1].unresolvedRefs = ["Schedule Z"];
  assert.match(assemble(s, ["a"], ["replace"]).fallback!, /cross-reference/);
});
test("BM25 works with changed block ids and zero matches falls back honestly", () => {
  const s = sample();
  assert.ok(keywordSelection(s).ids.includes("a"));
  s.request = "quantum banana";
  assert.equal(keywordSelection(s).ids.length, 3);
  assert.ok(keywordSelection(s).fallback);
});
test("plans reject unavailable operations, duplicate targets, existing revisions and inexact spans", () => {
  const s = sample(),
    selection = assemble(s, ["a"], ["replace"]),
    plan: DraftPlan = {
      summary: "Consent",
      clarification: null,
      choices: [],
      unresolved: [],
      edits: [
        {
          id: "1",
          tool: "replace",
          blockId: "a",
          original: s.blocks[0].text,
          replacement: "Provider may train models only with written consent.",
          explanation: "Consent",
        },
      ],
    };
  assert.equal(validatePlan(s, selection, plan), plan);
  assert.throws(
    () => validatePlan(s, selection, { ...plan, clarification: "Who?" }),
    /Clarification/,
  );
  assert.throws(
    () =>
      validatePlan(s, selection, {
        ...plan,
        edits: [...plan.edits, { ...plan.edits[0], id: "2" }],
      }),
    /Combine/,
  );
  assert.throws(
    () =>
      validatePlan(s, selection, {
        ...plan,
        edits: [{ ...plan.edits[0], original: "invented" }],
      }),
    /unique/,
  );
  assert.throws(
    () =>
      validatePlan(s, selection, {
        ...plan,
        edits: [{ ...plan.edits[0], tool: "comment" }],
      }),
    /unavailable/,
  );
  assert.throws(
    () =>
      validatePlan(s, assemble(s, ["c"], ["replace"]), {
        ...plan,
        edits: [{ ...plan.edits[0], blockId: "c", original: s.blocks[2].text }],
      }),
    /counsel/,
  );
});
test("input and cost accounting reserve every phase and keep negative/unknown savings", () => {
  const s = sample();
  assert.equal(validateSnapshot(s).blocks.length, 3);
  assert.throws(() => validateSnapshot({ ...s, request: "x".repeat(2001) }));
  assert.throws(
    () => validateSnapshot({ ...s, blocks: [s.blocks[0], s.blocks[0]] }),
    /Duplicate/,
  );
  const slots = reservationSlots(s, [...PIPELINES]);
  for (const p of PIPELINES) assert.ok(slots[`${p}:draft`] > 0);
  assert.ok(slots["interpret:interpret"] > 0);
  assert.ok(slots["jev:select:0"] > 0);
  assert.deepEqual(savings(1, 2), { absolute: -1, percent: -100 });
  assert.equal(savings(0, 1), null);
  assert.equal(savings(1, null), null);
});

test("provider adapter pins settings, rejects malformed drafts, and retains unknown attempted usage", async () => {
  const { runPipeline } = await import("../lib/agent/pipeline");
  const original = globalThis.fetch;
  const s = sample();
  const calls: { slot: string; cost: number | null }[] = [];
  let sent!: {
    reasoning_effort: string;
    response_format: { json_schema: { strict: boolean } };
    store: boolean;
  };
  const hooks = {
    async start() {},
    async finish(slot: string, cost: number | null) {
      calls.push({ slot, cost });
    },
  };
  try {
    globalThis.fetch = async (_url, init) => {
      sent = JSON.parse(init?.body as string);
      return Response.json({
        model: "gpt-5.4-mini-2026-03-17",
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          prompt_tokens_details: { cached_tokens: 50 },
        },
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                summary: "Nothing",
                clarification: null,
                choices: [],
                edits: [],
                unresolved: ["No executable proposal."],
              }),
            },
          },
        ],
      });
    };
    const ok = await runPipeline(
      s,
      "full",
      "frozen",
      { openai: "test-only" },
      () => {},
      hooks,
    );
    assert.equal(ok.status, "complete");
    assert.equal(sent.reasoning_effort, "none");
    assert.equal(sent.response_format.json_schema.strict, true);
    assert.equal(sent.store, false);
    assert.equal(ok.usage[0].cachedInputTokens, 50);
    assert.ok(calls[0].cost! > 0);
    globalThis.fetch = async () =>
      Response.json({
        model: "gpt-5.4-mini-2026-03-17",
        usage: { prompt_tokens: 100, completion_tokens: 20 },
        choices: [
          {
            finish_reason: "stop",
            message: { content: '{"edits":[{"tool":"delete_document"}]}' },
          },
        ],
      });
    const malformed = await runPipeline(s, "full", "frozen", {
      openai: "test-only",
    });
    assert.equal(malformed.status, "failed");
    assert.equal(malformed.plan.edits.length, 0);
    assert.equal(malformed.unknownUsage, false);
    globalThis.fetch = async () => {
      throw new DOMException("Cancelled", "AbortError");
    };
    const cancelled = await runPipeline(
      s,
      "full",
      "frozen",
      { openai: "test-only" },
      () => {},
      hooks,
    );
    assert.equal(cancelled.status, "failed");
    assert.equal(cancelled.unknownUsage, true);
    assert.equal(calls.at(-1)?.cost, null);
  } finally {
    globalThis.fetch = original;
  }
});

test("snapshot validation accepts actual-length opaque SuperDoc revision IDs", () => {
  const s = sample();
  s.blocks[2].existingRevisions = ["opaque-revision:" + "a".repeat(1200)];
  assert.equal(validateSnapshot(s).blocks[2].existingRevisions[0].length, 1216);
});
