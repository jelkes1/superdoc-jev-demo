# SuperDoc × Jev

**Jev evaluates the contract. SuperDoc executes the document changes. A human reviews the redlines.**

A standalone TypeScript/React example with a real DOCX editor, a connected negotiation workflow, tracked changes, anchored comments, human review, and atomic public-use limits. The original five-rule playbook and uploads remain at `/playbook`.

**V4: Guided deal desk with measured proof.** Follow four steps: review an agreement, approve proposed language, review real redlines, then export Word. “Explore freely” preserves your work. The live result counts verified Word operations, active processing time (excluding human pauses) and accumulated estimated model cost. An optional three-model comparison freezes identical clause evidence and never edits the document.

- [Measurement and comparison methodology](docs/comparison-methodology.md)
- [All 60 genuine evaluation responses](docs/evaluation-v4.json)
- [Browser-local measurements](lib/deal-desk/measurements.ts)
- [Canonical comparison inputs](lib/compare/input.ts) and [provider adapters](lib/server/comparison.ts)

- [Public demo](https://superdoc-jev.superdoc-1393.chatgpt.site)
- [Shared document operations and verification](lib/deal-desk/document.ts)
- [Policy definitions and supplied language](lib/deal-desk/rules.ts)
- [Live decision endpoint](app/api/deal-desk/route.ts)
- [Runnable headless example](examples/headless.ts) and [SDK transport adapter](examples/sdk-adapter.ts)
- [Social research and design rationale](docs/social-research-v3.md)
- [V3 verification](docs/verification-v3.md)
- [Unsent launch drafts](docs/launch-drafts-v4.md)
- [Previous atomic negotiation example](lib/negotiation/document.ts), available at `/negotiation`
- [Original five-rule playbook](lib/review/document.ts), available at `/playbook`
- [Developer films: 60-second story and 25-second feed cut](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.4.1)
- [Film production notes and unsent social copy](docs/developer-film.md)
- [Full guided walkthrough videos and exported DOCX](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.4.0)

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

1. Acknowledge the disclosure and select **Review agreement**.
2. Read the complete proposed language, choose replacements, then **Approve selected language & create redlines**.
3. Follow the finding queue: Accept, Reject, Next finding. Approve the numbered safeguard separately; request a telemetry draft or leave it for human review.
4. **Continue to export** summarizes accepted, rejected, pending and unresolved items. **Download Word** preserves remaining revisions.

The **This run** panel shows genuine accumulated measurements. **Inspect proof** reveals targets and receipts; **Compare models** is optional and requires separate acknowledgment before sending extracted text to OpenAI. Results are isolated from document execution.

**Explore freely** exposes the original workspace, policy controls and matrix; **Return to guided flow** resumes the current step. Changing terms or counter-editing a clause marks decisions stale. A no-change recheck makes no model call.

To reproduce the four-variant, five-repetition, three-model demonstration evaluation with a $2 cap:

```sh
npm run eval:compare
```

Expected labels and rationales are committed before calls. See the methodology for fixture agreement, every mismatch, latency ranges and limitations.

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
| `OPENAI_API_KEY` | Required for optional reasoning drafts and OpenAI comparison |
| `JEV_MODEL` | `jev-1.13.0` |
| `REASONING_MODEL` | `gpt-5.4` |
| `DAILY_BUDGET_USD` | `10`, shared across all visitors, UTC day |
| `IP_HASH_SALT` | Private random string; configure in production |

Both visitor and IP limits apply: five reviews or comparisons per clock hour. D1 reserves estimated maximum cost atomically before every model call, then reconciles reported usage. Unknown usage retains the reservation. Reasoning is limited to two calls per completed review. New model calls stop when the allowance is exhausted; existing document edits and export keep working.

Model IDs and cost constants are intentionally coupled. Substituting a model requires checking its schema, confidence semantics, prices and reservation bounds. See the adapter instructions in [architecture](docs/architecture.md). The threshold remains 95% for eligible automatic proposals and 70% for escalation after the live fixture check. Confidence is model-reported, not a calibrated legal-accuracy estimate. Exact replacement patterns and revision checks are separate requirements for every automatic edit.

## Small API surface

- `POST /api/compare`: frozen bounded clause context → incremental results for three exact model snapshots; separate disclosure acknowledgment, one shared review reservation.
- `POST /api/deal-desk`: current deal-desk rows → validated live decisions and usage.

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

The recording scripts require real Jev access. `npm run video:guided` records the current workflow to `outputs/video-v4`; render with `VIDEO_OUTPUT_DIR=outputs/video-v4 npm run video:render`. `npm run video:deal-desk` retains the earlier v3 scenario. Set `DEMO_BASE_URL` to record the hosted site. `npm run video:negotiation` records three real negotiation reviews to `outputs/video-v2`; render with `VIDEO_OUTPUT_DIR=outputs/video-v2 npm run video:render`. The original `npm run video:record` records the playbook workflow. FFmpeg produces captioned main/social MP4 cuts. Inspect the cuts and recorded DOCX before promoting them. [Production details](docs/video-storyboard.md).

## License

AGPL-3.0-only; see [LICENSE](LICENSE). SuperDoc is pinned to 2.16.0 and its notices are preserved. Third-party starter components retain their included licenses.
