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
