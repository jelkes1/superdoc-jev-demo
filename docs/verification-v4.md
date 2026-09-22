# V4 verification

Runtime: SuperDoc 2.16.0, SDK 2.13.0, React 19.2.6, TypeScript 5.9.3, Node 24.11.1. Live comparison models are pinned in `lib/compare/types.ts`.

The guided browser scenario runs actual SuperDoc extraction, four tracked replacements, accept/reject, a separately approved numbered insertion, human deferral, pending-item export and free-exploration/resume. Other cases cover mobile width and keyboard activation, zero eligible proposals, unavailable review provider, separately acknowledged comparison, incomplete responses and separation from document mutation/main-run cost. Orchestration tests use clearly test-only model responses. Live provider evidence is published separately.

Existing browser regressions retain stale/duplicate target guards, modified-pending-suggestion protection, accepted changes on rerun, counsel revision preservation, table/numbering retention, comments and DOCX reopening. A navigation guard prevents accepting/rejecting while a new finding's target is being read. Viewport fitting is deferred outside ResizeObserver delivery. Screenshots use the actual viewport without resizing the editor to capture a full page.

Unit/integration checks include timing boundaries and excluded human pauses, first verified edit, cumulative reported usage, cached-input discounts, unknown costs, incomplete/missing/duplicate comparison answers, identical canonical evidence, model unavailability without substitution, concurrent combined-cost reservations and shared review allowance. D1 settlement remains idempotent and unknown usage holds its reserved portion.

## Native Microsoft Word

Completed an interactive open → Save As (maintaining compatibility mode) → close → reopen in Microsoft Word 16.113.1 (16.113.26091740). The original remained unchanged. Both the original SuperDoc export and Word-saved copy were reopened in SuperDoc. Each retained three tables, six comments, four numbered paragraphs including the safeguard, and five logical tracked-change groups (two counsel and three pending agent proposals). XML comparison confirms the revision authors/content were preserved despite Word rewriting the package.

Hashes and counts: [Word round-trip evidence](word-roundtrip-v4.json). No repair dialog was observed. This verifies the fictional specimen, not arbitrary DOCX compatibility or layout equivalence across every page. The Wordbox service was unavailable without a new login, so this check used the already-installed native Word application.

## Genuine model evaluation

All 60 requests completed under the $2 local cap. Expected labels/rationales were committed before calls. See [methodology](comparison-methodology.md) and [every response](evaluation-v4.json), including fixture mismatches, disagreements, timing ranges, token costs and limitations.

## Release checks

TypeScript, ESLint, the production build and all 22 unit/integration checks passed. All 19 browser scenarios passed across the full-suite run and focused reruns after fixes; this is not a claim that the final 19 ran together in one pass. The final guided scenario additionally covers changing policy after accepting/rejecting and inserting a safeguard: only owned pending changes are cleared, two counsel revisions remain, accepted text survives, and the next proposals use 60 days. Rejecting an insertion may already remove its anchored explanation comment; cleanup now checks the current comment list and updates resolved-operation state incrementally.

A fresh clone at `5657bf7` passed `npm ci --ignore-scripts`, database initialization, production build, typecheck and all 22 unit tests. Its production server opened the sample and handled missing credentials explicitly. The final production recording uses the built application at `ecb157f` with real provider credentials loaded at runtime; no model responses or document operations are stubbed. The local production start command explicitly resolves `.dev.vars` from the source root, outside the deployable bundle.

The public URL was updated to Sites version 9 (`ecb157f`). Genuine hosted review, execution/export and all three comparison responses are retained in [hosted evidence](hosted-run-v4.json). The final guided browser check on that deployment uses test-only model transport while exercising real document operations. Provider transport and usage are separately evidenced by the genuine hosted and recorded runs. The recording's independent local production budget does not modify the public allowance.

The hosted export reopened with three tables, six comments, five logical tracked-change groups and its numbered safeguard. The final video export was also reopened successfully with the same table, comment, revision-group and safeguard counts. Exact video hashes, sampled frames and inspection limits are in [video verification](video-verification-v4.json); [recorded measurements](recorded-run-v4.json) retain actual usage and document-operation evidence. The earlier video exposed a cleanup error during inspection and is not included in release assets.

LinkedIn, X and TypeSafe messages remain drafts; none were sent.
