# SuperDoc × Jev

**Jev evaluates the contract. SuperDoc executes the document changes. A human reviews the redlines.**

A standalone TypeScript/React example with a real DOCX editor, five vendor playbook rules, tracked replacements, human review, a small server API and atomic public-use limits.

**Current release status:** live Jev review is connected. The hosted fictional fixture produced three verified tracked replacements, an acceptable New York governing-law decision, and unresolved findings. See [verification](docs/verification.md) and the [launch gate](docs/launch-checklist.md). No model results are simulated in the app.

- [Public preview](https://superdoc-jev.superdoc-1393.chatgpt.site)
- [Core integration](lib/review/document.ts)
- [Architecture and model substitution](docs/architecture.md)
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

The original DOCX stays in the browser. Running review sends extracted text to TypeSafe and, for up to two unresolved findings, OpenAI. The application does not retain document contents. Provider handling remains governed by provider terms. Public visitors need neither login nor their own API key.

## Try the workflow

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

The fixture is generated by `scripts/make-fixture.py` (Python + `python-docx`). It uses numbered section headings and three tables. It is entirely fictional and supplied for developer demonstrations.

## Hosting and video

The `.openai/hosting.json` manifest is for the owner’s Sites deployment. When forking, replace its project registration with your own before publishing. The logical `DB` binding and generated Drizzle migration support the public counters; secrets belong in the hosting environment, never in the manifest or browser bundle.

The recording scripts require real Jev access and fail closed if the expected live redline/ambiguity is absent. `npm run video:record` records two real reviews, then `npm run video:render` produces captioned main/social MP4 cuts using FFmpeg. Inspect the cuts and recorded DOCX before promoting them. [Production details](docs/video-storyboard.md).

## License

AGPL-3.0-only; see [LICENSE](LICENSE). SuperDoc is pinned to 2.16.0 and its notices are preserved. Third-party starter components retain their included licenses.
