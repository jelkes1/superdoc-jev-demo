# Decisions into Word redlines

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
