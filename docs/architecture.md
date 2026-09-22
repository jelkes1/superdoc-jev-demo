# Decisions into Word redlines

## Living Deal Desk (v3, current home page)

The guided fixture has eight explicit locations across agreement clauses, order-form cells and a numbered schedule. `lib/deal-desk/rules.ts` owns those anchors, supplied language and policy settings. It is not a general cross-document dependency detector. `lib/deal-desk/document.ts` owns extraction, target resolution, tracked execution, receipts, readback and revision guards. `app/api/deal-desk/route.ts` calls Jev for a batch of changed locations and uses the shared D1 reservation/limits module. Full probability distributions and the separate confidence value remain visible.

The review matrix is a view of those actual responses. A cache key includes the complete extracted clause, bounded surrounding context, revision IDs at the location and policy. Changed context invalidates dependent rows; a no-change recheck makes no provider request. Only supported violations with confidence ≥95% qualify for automatic proposals. Lower confidence needs approval of the complete supplied language. Missing clauses always need human approval. NEEDS_REVIEW never becomes an automatic edit.

Each proposal checks the fresh document revision, unique target and tracked capability. Paragraph and table-cell text use `doc.replace`; the missing safeguard uses `doc.lists.insert`. The application checks created revisions, resulting text and preservation of all existing revision fingerprints. The batch is sequential, not atomic: if a later operation fails, earlier proposals remain reviewable. Explanation comments are added and read back separately. To preserve the structural revision's identity, the numbered-insertion explanation anchors to its preceding list item.

The telemetry exception can request a bounded OpenAI draft under the consent policy. HMAC binds the normalized clause and policy to its review. Fresh text/context must still match, and a person must approve the draft before tracked replacement. The prohibition policy leaves that exception for manual review. The app does not invent a negotiated position.

Policy changes clear only unchanged pending suggestions owned by this session. Accepted work, counsel changes and unrelated revisions stay. Editing or partially resolving a pending suggestion in the native editor blocks replacement conservatively; use the demo's Accept/Reject controls for coordinated review. Imported headless revisions remain ordinary pre-existing revisions and are not silently adopted as session-owned suggestions.

`examples/headless.ts` runs the shared operations through the published Node SDK. `examples/sdk-adapter.ts` normalizes SDK mutation options and transport envelopes; it does not replace the document engine. The CLI is a local/server example, separate from the hosted Workers runtime. Local receipts contain document text and should remain private for real contracts. The default CLI honors the same ≥95% gate; the explicit `--approve-supplied-language` flag approves only the four supplied replacements.

## Connected negotiation (v2, `/negotiation`)

The retained negotiation route opens a returned agreement with real counsel revisions and comments. Three known locations are resolved through SuperDoc. `POST /api/negotiate` evaluates them against explicit commercial instructions; it does not discover an arbitrary agreement's dependency graph.

| Module | Responsibility |
| --- | --- |
| `lib/negotiation/scenario.ts` | Known-location discovery, supplied fallback patterns, cap settings and version |
| `lib/negotiation/document.ts` | Snapshot, overlapping revisions, revision-guarded preview/atomic apply, receipts, original/final readback, anchored comments and selective rerun |
| `app/api/negotiate/route.ts` | Real Jev judgments with the shared D1 budget and rate controls |
| `app/negotiation-workspace.tsx` | Connected proposal UI, explicit human decisions, direct manual edits and Word download |

`doc.mutations.preview` validates a plan without writing. `doc.mutations.apply` executes its text rewrites with `atomic: true`, `changeMode: 'tracked'`, and the held `expectedRevision`. On SuperDoc 2.16.0, `text.rewrite` requires a query ref or a text selector; this example uses a text selector scoped to the exact stable block and requires one match. A raw selection target is not supported by that v2 operation.

The application rejects plans prepared before a document change. No automatic rebasing occurs. A new review resolves current text; supported fallback transformations retain text outside the cap phrases. Overlapping counsel revisions require explicit accept/reject. Low-confidence and NEEDS_REVIEW judgments remain unresolved unless a person reviews and explicitly approves the supplied fallback.

After application, verify each receipt's tracked IDs, resulting text, original-text projection, and pre-existing revision fingerprints. Comments are added separately and individually read back; comment failure is reported distinctly from a verified text edit. Comments are not part of the atomic text plan. Partial accept/reject choices are allowed and surface remaining inconsistency.

Rerun validation checks both revision identities and the complete pending clause text. It blocks when someone edits another span in that clause, even if the original revision's fingerprint is unchanged. Only still-pending owned revisions and their owned explanation comments are cleared. Resolved comments and unrelated history are retained.

Jev is the only model used by this guided route. The existing reasoning adapter remains in the five-rule playbook at `/playbook`. To substitute a decision model in v2, replace the bounded provider call in `app/api/negotiate/route.ts`, retaining the actual response semantics and updating pricing/reservation constants.

## Five-rule playbook (v1, retained)

Jev evaluates clauses against five explicit vendor policies. SuperDoc reads and edits the DOCX in the browser. The application chooses an operation, enforces tracked mode and verifies it. A person accepts or rejects each change.

## Modules to copy

| Module | Responsibility |
| --- | --- |
| `lib/review/document.ts` | Published SuperDoc APIs: extraction, fresh targets, tracked replacement, verification, rerun guards |
| `lib/review/playbook.ts` | Five policies and three narrowly matched replacement templates |
| `lib/server/jev.ts` | Batched TypeSafe requests and full, validated distributions |
| `lib/review/routing.ts` | Confidence boundaries and unresolved outcomes |
| `lib/server/reasoning.ts` | Bounded OpenAI drafting; never document operations |
| `lib/server/budget.ts` | Atomic D1 budget reservation, visitor/IP counters, settlement |
| `lib/server/tokens.ts` | Stateless authorization of an unresolved finding for reasoning |
| `app/api/review/route.ts` | Newline-delimited JSON stream of completed provider batches |
| `app/api/reason/route.ts` | At most two drafts per completed review |
| `app/review-workspace.tsx` | Human review UI, navigation and DOCX export |

## Request flow

1. Read ordered body blocks with `doc.blocks.list`. Track headings and tables. Query visible text within stable block addresses. Assemble adjacent context without an LLM preprocessing call. Bound each clause to 6,000 characters and context to 12,000; incomplete contexts stay unresolved.
2. Send clause IDs, rule IDs, text/context, a document revision and a versioned playbook to the server. Validate the request, enforce the 25,000-token ceiling, reserve the maximum estimated cost in D1, then call Jev in bounded batches. Its four choices combine relevance and policy judgment: `ACCEPTABLE`, `UNACCEPTABLE`, `NEEDS_REVIEW`, `NOT_APPLICABLE`.
3. Preserve each returned confidence and all four probabilities. Stream only actual completed responses. A failed or incomplete stream cannot trigger automatic edits.
4. Default automatic proposals require confidence ≥95%, `UNACCEPTABLE`, complete context and an exact supported template. `NEEDS_REVIEW` always remains unresolved. Confidence <70% routes to reasoning; the 70–95% band stays with a human. High-confidence violations without a template can also receive a reasoning draft.
5. For up to two eligible findings, request a bounded OpenAI draft. Bind each authorization to its exact clause, policy and review using HMAC. Drafts require a human click to become tracked proposals; they are never silently applied.
6. Check capabilities and existing revisions, resolve original text uniquely within its stable block, check the document revision, then call `doc.replace` with `changeMode: 'tracked'`. Verify the receipt, new tracked-change IDs, final text and original text from `doc.projectHtml({reviewMode:'original'})`. SuperDoc may preserve unchanged text and track only the edited words.
7. A rerun rejects only unchanged, pending suggestions owned by the current review. Accepted/rejected changes and pre-existing revisions are preserved. Changed or partially resolved pending suggestions block automatic replacement. Export with `isFinalDoc: false` retains revisions.

## Revision detail in SuperDoc 2.16.0

Use the monotonic revision from `doc.info({}).revision` / `doc.blocks.list().revision` for mutation guards. `query.match().evaluatedRevision` can be a package revision token and is not accepted by these mutation operations. The example re-reads document revisions around target resolution and passes the documented mutation revision.

## Privacy and limits

The original DOCX and editing operations stay in the browser. Extracted text is sent to TypeSafe and, for selected findings, OpenAI. The app retains no document content, prompts, model responses, or document-related application logs. TypeSafe SDK logging is disabled; OpenAI requests use `store: false`. Provider-side handling remains governed by their terms.

D1 stores only salted visitor/IP identifiers, time buckets and monetary counters. IP hashes rotate daily. Old counters are pruned after seven days. Configure a stable private `IP_HASH_SALT`; never use browser state as the only budget authority. Both visitor and IP limits apply: five review starts per clock hour. Reservations are made transactionally before provider calls; concurrent calls cannot allocate the same allowance. Reasoning is limited to two requests per completed review, bound to the same visitor/IP. No automatic provider retries occur. Unknown usage keeps the entire reservation; reported usage settles once. Budget resets at UTC midnight. Changing pinned model versions requires updating the pricing and reservation bounds.

The input-cost bound uses serialized UTF-8 bytes plus overhead, which conservatively bounds ordinary text tokenization for the pinned models. The reasoning output cap is 2,000 tokens. Reserve before all calls, charge reported usage afterward, and fail closed on missing usage. An unexpected usage overrun is charged rather than silently clamped.

## Substitute another decision model

Replace `evaluateBatch` in `lib/server/jev.ts`. Keep the four-way decision interface, actual confidence and full probability distribution (if the model provides them), stable IDs, revisions and playbook versions. If a provider does not expose confidence/probabilities, change the public interface and disable automatic routing; do not invent them. Recalculate reservation/pricing constants and add adapter contract tests before enabling a new model. Tune thresholds against explicit sample outcomes and human review; this is not a legal-accuracy benchmark.

## Boundaries

English text-based DOCX only; 10 MB and 25,000 extracted tokens. Body paragraphs, headings and table cells are covered. Headers/footers, images/OCR, text boxes and other non-body stories are outside automatic review. Unsupported blocks and incomplete contexts remain unresolved. Unfamiliar clause patterns do not get canned replacements. Cross-references and missing definitions can still require human review. This is a developer demonstration, not a complete legal review system.

Drafting candidates prioritize substantive clause text over short table labels and cross-references, and relevant findings over uncertain non-relevance. NEEDS_REVIEW gets priority within those groups. At most two authorized findings are drafted; every other finding remains visible for human review. This scheduling never changes Jev’s returned choice or confidence.
