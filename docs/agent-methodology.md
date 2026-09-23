# Document agent: method and findings

This example asks where Jev helps a document agent. SuperDoc 2.16.0 makes the Word document addressable, Jev selects context and supported operations, a pinned LLM drafts, and SuperDoc executes approved changes and verifies the result. Direct Jev selection is the UI default; the evaluation does not establish it as the fastest or cheapest approach.

## Frozen inputs and genuine runs

The fictional DOCX has 18,141 extracted text tokens, 263 addressable passages, three tables, numbered clauses, cross-references, two counsel revisions (four OOXML revision fragments) and two comments. Its long implementation appendix contains repeated synthetic operational procedures; this is not a representative corpus of real legal agreements. Serialized model evidence is larger: 27,425 context tokens including titles, section labels and targets.

`fixtures/agent/expected.json` and the exact DOCX hash were committed at `df22220` before the formal evaluation. Required passages, allowed targets, preserved payment text and name-scope clarification were fixed first. The initial pilot is retained separately; it exposed missing structural context and led to fixture/prompt fixes before the formal run. Pilot costs count toward the cap.

Five repetitions × three tasks × four pipelines produced 60 workflows. The order rotates by repetition. Each starts with a fresh real SuperDoc browser instance and fresh provider requests. Application results are never cached; provider prompt caching is allowed and reported cached-token discounts are retained. The shared drafting model is `gpt-5.4-mini-2026-03-17`, reasoning effort `none`, strict structured output, output ceiling 4,000 tokens. Interpretation uses the same model with a 1,200-token ceiling. Jev is `jev-1.13.0`, SDK 0.6.0, with retries disabled.

- **Full context:** every supported passage and both actual operations.
- **Keyword search:** deterministic BM25 top 20 nonzero matches, then structural dependencies; deterministic operation selection.
- **Jev:** independent RELEVANT / IRRELEVANT / UNCERTAIN decisions for each passage and each actual operation. Only IRRELEVANT at ≥95% confidence is excluded. Native probabilities and separate confidence are preserved. Batches contain at most 40 passages / 6,000 evidence tokens, up to three concurrent calls.
- **Interpret first + Jev:** original request, outline and definitions produce a short intent/constraints/clarification object. A clarification stops before selection/drafting; otherwise the original request remains alongside the interpretation.

Dependencies include neighboring passages within a section, table peers, definitions, and resolvable Section/Schedule references. Closure is transitive. Unresolved references or empty selection fall back to the full supported document. The actual registry contains only tracked replacements and anchored comments. No invented tools inflate schema savings.

## Outcome and approval

Formal fixture execution uses **automated fictional-fixture approval**: only proposed operations on frozen permitted targets are approved. Unexpected proposals are retained but withheld and cause outcome disagreement. This is stricter than a person accepting a broader draft. Generated wording need not match exactly: checks require 60 days in both renewal locations, written consent in all four training provisions, or clarification with no edits for ambiguous names. These are narrow heuristic assertions, not legal review. Extra consent language outside the frozen targets fails the scoped outcome even if a lawyer might consider it harmless.

SuperDoc checks actual capabilities, document revision, unique exact source text, protected counsel revisions, tracked execution receipts, whole-block readback and preserved revision fingerprints. Each successful document operation counts once; OOXML fragments do not count as extra edits. Comments are verified separately. A proposal touching an existing revision, duplicate target or unsupported tool fails visibly. A later failure preserves earlier reviewable work. Manual approval pauses are excluded from processing time.

For public comparisons, all copies start from the same export and frozen request. The unmodified sample presets use the frozen fixture checks. Other documents require the reviewer to confirm equivalent requested changes and preserved terms, alongside the same verified target set and no failed, unresolved or unapplied operations. A confirmation does not establish legal accuracy. Missing outcomes, zero-edit clarification, unknown costs and invalid timing cannot produce a savings claim. Negative differences are displayed as longer time or higher cost.

## Measurements and costs

Browser extraction, request-to-validated-plan elapsed time and guarded execution/verification form total active processing. Initialization, other pipeline lanes, export and approval pauses are excluded. Provider timings are components of elapsed time, not added twice. Local evaluation calls the shared provider adapter directly, so it includes outbound provider HTTP transport but not hosted Worker/request overhead. Browser/Node handoff bookkeeping is excluded. Hosted live measurements include browser API transport. Backgrounding invalidates live timings. First-edit time includes extraction, planning and execution through the first verified replacement; clarification has no first edit.

Model usage includes every selection batch, interpretation and drafting call. Estimated spend uses versioned September 22, 2026 prices: Jev $0.042/M input tokens; GPT-5.4 mini $0.75/M input, $0.075/M cached input and $4.50/M output. Unknown attempted usage retains its reservation. Licensing, hosting and human review are outside these figures. Context/schema token counts use `o200k_base` on serialized evidence/registry; provider-reported input tokens include system instructions and protocol overhead too.

The 60 formal workflows reported **$0.73237** in model spend. Pilot + formal + 20 held-out checks reserved/reconciled **$0.885741**, below the **$2** cap. The ledger persists before calls; a crash retains the reserved maximum. Rerunning a completed ledger resumes/skips completed slots. Use a separate output ledger for a new independently capped evaluation; never delete a ledger to evade its cap.

## What happened

- Renewal: all four pipelines met the scoped outcome in 5/5 repetitions. Median processing: full 2.42s, keyword 1.99s, Jev 3.32s, interpretation + Jev 4.80s. Jev was not the time/cost winner. Full-context caching materially affects spend; see each request’s usage.
- Training: 0/5 complete scoped outcomes for every pipeline. Keyword missed two required passages each time. Jev and full context retained all required passages, but drafts missed the Operational Signals exception or added edits beyond the permitted targets. One keyword draft failed validation for duplicate block operations. None of these failures is hidden by a savings headline.
- Company names: every approach requested clarification in 5/5 runs. Interpretation stopped early and avoided selection/drafting. These are clarification outcomes, not verified-edit savings.
- Full fallback rate in the formal fixture: 0/60. Required-context coverage and fallback behavior are also tested independently.

See `agent-summary.json` for every median/range, mean cost, schema tokens, cache totals and outcome counts; `agent-evaluation-v1.json` contains all 60 actual plans, native Jev decisions, usage and execution receipts. Invalid draft payloads are represented by validation errors and usage, not a fabricated valid plan. Intermediate interpretation objects were not retained in the original formal artifact; the released browser now displays them in proof for new runs.

## Held-out checks and limits

`fixtures/agent/held-out.json` was separately frozen before 20 fresh calls: five short cases × four pipelines, one repetition each. These are planning/context probes, not Word execution benchmarks. Reordering, paraphrasing, missing terms, conflicting definitions and ambiguous companies are included. Jev retained the paraphrased clause keyword search missed, and returned clarification on the conflicting definitions where the other three did not. With n=1 and short synthetic contexts, these do not establish comparative accuracy. Every held-out response is retained.

This release does not support headers, footers, text boxes, images, external documents, arbitrary structural insertions or exhaustive legal dependency inference. It does not tune the exclusion threshold after seeing results. No local distillation, broad accuracy benchmark, legal correctness claim or historical savings reuse is included.

## Reproduce

Follow the root README’s fresh install, database initialization and local-server steps, then:

```sh
npm run eval:agent
npm run eval:agent:held-out
npm run verify:agent-exports
npm run summarize:agent
```

The default commands resume the retained results. To make fresh provider calls and write new artifacts, keep the server running and use separate ledgers:

```sh
export AGENT_EXPORT_DIR=outputs/agent-replay
export AGENT_EVAL_OUT=$AGENT_EXPORT_DIR/report.json
export AGENT_FORMAL_REPORT=$AGENT_EVAL_OUT
export AGENT_HELD_OUT_OUT=$AGENT_EXPORT_DIR/held-out.json
export AGENT_VERIFICATION_OUT=$AGENT_EXPORT_DIR/export-checks.json
export AGENT_SUMMARY_OUT=$AGENT_EXPORT_DIR/summary.json
npm run eval:agent
npm run eval:agent:held-out
npm run verify:agent-exports
npm run summarize:agent
```

The scripts read model keys from ignored `.dev.vars`. Public app calls use the shared five-per-visitor/IP-per-clock-hour allowance and $10/day atomic D1 budget. Local evaluation uses its separate durable $2 ledger. Formal and held-out scripts never log keys or uploaded documents. Evaluation output contains only the explicitly fictional fixtures.

`lib/agent/document.ts` owns addressability and guarded operations. `selection.ts` owns context assembly/BM25. `pipeline.ts` owns provider calls and plan validation. `browser.ts` owns timing, transport and execution. `examples/document-agent.ts` shows the application boundary. `agent-budget.ts` provides additive reservation/slot tables without changing existing comparison behavior. The `start → plan → finish` API binds each single-use pipeline slot to the visitor and frozen snapshot hash; unstarted slots are released on cancellation/expiry, attempted unknown usage stays reserved.

Substitute a decision provider in `runPipeline` by returning complete independent relevance/tool decisions, explicitly defining any confidence semantics, and updating reservation/pricing constants. Do not invent confidence for a provider that does not return it. All four pipelines must keep the same draft instructions and actual operation registry for a controlled comparison.

## Word and browser verification

Every one of the 60 exported DOCX files was reopened in SuperDoc: tracked edits, exact proposed text, both counsel revisions, two comments, three tables and three numbered items survived. `renewal-1-jev` and `training-2-full` were opened without repair prompts and saved as new DOCX files in native Microsoft Word for Mac, then reopened and checked in SuperDoc. This is an actual Word round trip; it is not a claim of pixel-identical layout or legal correctness. See `agent-export-verification.json` for the 62 files and hashes.

Focused browser checks cover explicit approval, unchanged recheck with no model call, review/accept/reject/download, independent comparison copies, preview, stale and duplicate targets, unsupported operations, modified suggestions, anchored comments, keyboard tabs and mobile width. Unit checks exercise confidence boundaries, dependencies/fallback, malformed plans and atomic concurrent reservation/slot claims. Browser transport stubs are labeled tests; public results use genuine model calls.

The export verification script reopens Word files in SuperDoc; it does not run Microsoft Word. The native round trips for this release are independently recorded in `agent-native-word-verification.json`.
