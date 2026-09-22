# SuperDoc × Jev

**Jev evaluates the contract. SuperDoc executes the document changes. A human reviews the redlines.**

A standalone TypeScript/React example with a real DOCX editor, a connected negotiation workflow, tracked changes, anchored comments, human review, and atomic public-use limits. The original five-rule playbook and uploads remain at `/playbook`.

**V2:** one supplied deal instruction connects the liability clause, order-form table, and data-protection schedule in a fictional agreement already marked up by counsel. Preview a proposal, resolve overlap, edit the document yourself, and watch the stale proposal get blocked before applying verified redlines. No model results are simulated. See [v2 verification](docs/verification-v2.md).

- [Public preview](https://superdoc-jev.superdoc-1393.chatgpt.site)
- [Core integration](lib/review/document.ts)
- [Connected proposals: snapshot, preview, apply, verify](lib/negotiation/document.ts)
- [Supplied fallback language and scenario](lib/negotiation/scenario.ts)
- [Architecture and model substitution](docs/architecture.md)
- [V2 negotiation videos and recorded Word export](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.2.0)
- [V1 playbook videos](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.1.0)
- [Video workflow](docs/video-storyboard.md)
- [Unsent launch drafts](docs/launch-drafts.md)

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

The original DOCX stays in the browser. Running review sends extracted text to TypeSafe. The separate playbook route can send up to two unresolved findings to OpenAI for drafting. The application does not retain document contents. Provider handling remains governed by provider terms. Public visitors need neither login nor their own API key.

## Try the workflow

The home page is a guided negotiation, bounded to three known locations:

1. Prepare the counterproposal using the supplied general and data-protection caps.
2. Open the schedule card and explicitly accept or reject counsel's overlapping edit.
3. Review the current text. Preview the three linked replacements.
4. Choose **Edit this clause yourself** and add a sentence. Check the old proposal: it is blocked. Fresh review retains your sentence.
5. Propose the connected tracked changes, then accept or reject individual redlines. Partial decisions flag remaining inconsistency.
6. Download the Word document with unresolved revisions and comments. Rerun to replace only unchanged pending suggestions; accepted work and counsel's unrelated edits remain.

This guided example uses approved fallback patterns, not unconstrained drafting. Jev's actual response remains visible; uncertainty needs explicit human approval of the supplied fallback. No drafting model is called on this route. Changing the cap controls changes the explicit instructions.

The [five-rule playbook](app/playbook/page.tsx) is a separate example:

1. Review the fictional, 14-page Northstar–Meridian software agreement.
2. Inspect each returned decision, confidence and full probability distribution.
3. Jump from a finding to its clause. A confident violation matching an exact template can become a verified tracked replacement.
4. Review ambiguous findings and any optional reasoning draft. A draft needs a human click before becoming a tracked proposal.
5. Change the cap or threshold and rerun. Only unchanged pending suggestions belonging to this review are replaced. Existing revisions and accepted changes survive. Editing a pending suggestion blocks automatic replacement until it is resolved.
6. Accept/reject in the panel or editor and download a DOCX retaining unresolved redlines.

English text-based DOCX only, up to 10 MB and 25,000 extracted tokens. Body paragraphs, headings and table cells are covered. Unsupported content and incomplete context stay visible for human review.

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

The recording scripts require real Jev access. `npm run video:negotiation` records three real negotiation reviews to `outputs/video-v2`; render with `VIDEO_OUTPUT_DIR=outputs/video-v2 npm run video:render`. The original `npm run video:record` records the playbook workflow. FFmpeg produces captioned main/social MP4 cuts. Inspect the cuts and recorded DOCX before promoting them. [Production details](docs/video-storyboard.md).

## License

AGPL-3.0-only; see [LICENSE](LICENSE). SuperDoc is pinned to 2.16.0 and its notices are preserved. Third-party starter components retain their included licenses.
