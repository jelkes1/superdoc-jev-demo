# SuperDoc × Jev

**Jev evaluates the contract. SuperDoc executes the document changes. A human reviews the redlines.**

A standalone TypeScript/React example with a real DOCX editor, a connected negotiation workflow, tracked changes, anchored comments, human review, and atomic public-use limits. The original five-rule playbook and uploads remain at `/playbook`.

**V3: Living Deal Desk.** Take over a fictional negotiation already marked up by counsel. A live review matrix links eight typed decisions to actual Word locations. Propose substantive data-use language, update order-form cells, insert a real numbered safeguard, preserve negotiated payment terms, and keep unresolved telemetry/liability visible. Edit the document and recheck only changed context.

- [Public demo](https://superdoc-jev.superdoc-1393.chatgpt.site)
- [Shared document operations and verification](lib/deal-desk/document.ts)
- [Policy definitions and supplied language](lib/deal-desk/rules.ts)
- [Live decision endpoint](app/api/deal-desk/route.ts)
- [Runnable headless example](examples/headless.ts) and [SDK transport adapter](examples/sdk-adapter.ts)
- [Social research and design rationale](docs/social-research-v3.md)
- [V3 verification](docs/verification-v3.md)
- [Unsent launch drafts](docs/launch-drafts-v3.md)
- [Previous atomic negotiation example](lib/negotiation/document.ts), available at `/negotiation`
- [Original five-rule playbook](lib/review/document.ts), available at `/playbook`
- [Captioned videos and exported DOCX](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.3.0)

## Run locally

Requires Node 22.13+ and npm. The app runs on Vinext/Vite and the Cloudflare Workers local runtime. No Cloudflare account is required for local development.

```sh
npm ci
cp .env.example .dev.vars
# Add TYPESAFE_API_KEY and OPENAI_API_KEY to .dev.vars.
# Keep this file private; it is ignored by Git.
npm run build
npm run db:init
npm run dev
```

Open the URL printed by the server (normally `http://localhost:5173`). The sample opens automatically. Without model keys you can open, edit and export documents; review explicitly reports that the provider is unavailable.

`db:init` applies the initial local-only D1 schema. Run it once per fresh local database, after the first build. It intentionally reports an error if replayed onto an existing schema. Publishing with Sites applies the generated production migration separately. For later schema changes, use `npm run db:generate` and apply only pending migrations.

The original DOCX stays in the browser. Running review sends extracted text to TypeSafe. Optional reasoning can send up to two unresolved findings per review to OpenAI for drafting. The application does not retain document contents. Provider handling remains governed by provider terms. Public visitors need neither login nor their own API key.

## Try the workflow

1. Consent to sending extracted clauses to TypeSafe, then review the agreement.
2. Open **Review matrix**. Inspect actual choices, confidence and execution routing.
3. Review the four supplied replacements. **Approve language & propose 4 redlines** applies them as individually guarded, verified tracked edits. A ≥95% eligible decision can also propose an edit without the extra language-approval step.
4. Open **Numbered safeguard** and approve the insertion. It is a real Word list item, with its own reviewable structural revision.
5. Open **Telemetry exception**. Its uncertainty stays explicit; an eligible finding can request one of two optional OpenAI drafts. Review and approve any draft before proposing it.
6. Accept/reject a change, or make a counter-edit in the document. Recheck sends only changed locations/context/policy. A no-op rerun makes no model call.
7. Inspect **Execution** for the target, revision, receipt, tracked IDs and readback checks. Download Word with remaining revisions and comments.

The sample uses eight known clause anchors and bounded supplied language. It does not discover arbitrary dependencies or perform exhaustive contract review. Unsupported/missing/duplicate locations remain visible. Batch edits are sequential and individually guarded; completed edits remain reviewable if a later operation fails.

## Run without a browser

```sh
# Export your own TYPESAFE_API_KEY first.
npm run demo:headless -- ./public/deal-desk.docx
# Explicit approval of the supplied fictional replacement language:
npm run demo:headless -- ./public/deal-desk.docx --approve-supplied-language
```

The runner saves `outputs/headless/reviewed.docx` and a local receipt. Use **Open DOCX** in the browser to continue reviewing that file. Without the approval flag, only eligible ≥95% confident violations are proposed; zero qualifying changes is a valid result. The CLI keeps the same tracked execution and readback checks through the SDK adapter. Its local API calls use your own key, outside the hosted demo's allowance. Local receipts include document text; keep them private when using your own documents.

## Configuration

| Variable | Default / purpose |
| --- | --- |
| `TYPESAFE_API_KEY` | Required for real Jev review |
| `OPENAI_API_KEY` | Required for optional reasoning drafts |
| `JEV_MODEL` | `jev-1.13.0` |
| `REASONING_MODEL` | `gpt-5.4` |
| `DAILY_BUDGET_USD` | `10`, shared across all visitors, UTC day |
| `IP_HASH_SALT` | Private random string; configure in production |

Both visitor and IP limits apply: five reviews per clock hour. D1 reserves estimated maximum cost atomically before every model call, then reconciles reported usage. Unknown usage retains the reservation. Reasoning is limited to two calls per completed review. New model calls stop when the allowance is exhausted; existing document edits and export keep working.

Model IDs and cost constants are intentionally coupled. Substituting a model requires checking its schema, confidence semantics, prices and reservation bounds. See the adapter instructions in [architecture](docs/architecture.md). The threshold remains 95% for eligible automatic proposals and 70% for escalation after the live fixture check. Confidence is model-reported, not a calibrated legal-accuracy estimate. Exact replacement patterns and revision checks are separate requirements for every automatic edit.

## Small API surface

- `POST /api/negotiate`: three bounded clause locations + document revision + versioned deal settings → actual Jev judgments, full distributions, separate confidence, and measured usage. Shares the same atomic budget/rate controls as playbook review.
- `POST /api/review`: clause context + document revision + versioned playbook → NDJSON events: start, completed decision batches, measured usage, completion/error.
- `POST /api/reason`: one authorized unresolved finding → a bounded replacement proposal or explanation that human review is needed.
- `GET /api/status`: configuration availability, model IDs and public limits; no secrets.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
# In another terminal: npm run dev
npm run test:browser
```

Unit/integration tests cover routing boundaries, probability validation, malformed input, interrupted responses, provider failures, reasoning authorization, concurrent budget reservation and settlement. Browser tests use real SuperDoc operations for tracked replacements, stale/duplicate targets, modified suggestions, reruns, existing revisions, acceptance/rejection and DOCX export/reopen. The UI orchestration tests use explicitly test-only provider transport fixtures; they do not establish Jev model quality. Production contains no mock-result mode.

The original fixture is generated by `scripts/make-fixture.py` (Python + `python-docx`). The negotiation fixture adds counsel revisions, comments, and Word numbering with `scripts/make-negotiation-fixture.py`; its explicit OOXML parts and validation receipt are retained in `fixtures/negotiation` and `docs/fixture-validation-v2.json`. Both agreements are entirely fictional and supplied for developer demonstrations.

## Hosting and video

The `.openai/hosting.json` manifest is for the owner’s Sites deployment. When forking, replace its project registration with your own before publishing. The logical `DB` binding and generated Drizzle migration support the public counters; secrets belong in the hosting environment, never in the manifest or browser bundle.

The recording scripts require real Jev access. `npm run video:deal-desk` records the current workflow to `outputs/video-v3`; render with `VIDEO_OUTPUT_DIR=outputs/video-v3 npm run video:render`. Set `DEMO_BASE_URL` to record the hosted site. `npm run video:negotiation` records three real negotiation reviews to `outputs/video-v2`; render with `VIDEO_OUTPUT_DIR=outputs/video-v2 npm run video:render`. The original `npm run video:record` records the playbook workflow. FFmpeg produces captioned main/social MP4 cuts. Inspect the cuts and recorded DOCX before promoting them. [Production details](docs/video-storyboard.md).

## License

AGPL-3.0-only; see [LICENSE](LICENSE). SuperDoc is pinned to 2.16.0 and its notices are preserved. Third-party starter components retain their included licenses.
