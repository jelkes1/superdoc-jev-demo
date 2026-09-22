# Verification record

Verified locally on 2026-09-22 UTC with Node 24.11.1, SuperDoc 2.16.0 and Playwright Chromium (Playwright 1.58.2).

- `npm ci`: clean dependency installation passed after repairing the generated lockfile.
- `npm run typecheck`: passed.
- `npm run lint`: passed after the editor lifecycle annotation was clarified.
- `npm test`: 13 tests passed, including real local D1 transactions under concurrent requests.
- `npm run test:browser`: 7 browser tests passed in 46.3 seconds. This is test-suite duration, not a model latency claim.
- `npm run build`: production build passed. The CSS optimizer reports warnings about the standards-based `::highlight()` selectors in SuperDoc’s stylesheet, and the editor creates a large client chunk.
- `npm run db:init`: initial local D1 schema applied successfully.
- Fictional DOCX rendered to 14 PDF pages; representative main-contract and appendix pages inspected.
- Real tracked replacements were accepted/rejected, rerun and exported. Reopening the DOCX preserved the replacement revision, all three tables and numbered section headings.
- Build output scanned for the configured model credential: no matches.
- Recording fails closed when live Jev access or the expected genuine findings are absent.

The UI orchestration tests use test-only response fixtures; the document operations and export/reopen checks use the real SuperDoc engine. No mocked response mode ships in the application. These tests do not verify Jev’s judgments, reasoning quality or legal accuracy.

Live TypeSafe access and OpenAI reasoning are now verified through the hosted flow. The first bounded proof returned 25 decisions from five actual browser-extracted clauses, including three violations, acceptable New York law and a missing data rule. All three eligible replacements passed SuperDoc receipt, resulting-text and tracked-revision checks.

The full 104-clause fictional fixture produced 520 decisions: 154,606 input tokens, 32,816 output tokens, 4,879 ms reported server review time and $0.006493452 Jev cost at the pinned pricing. The three supported violations returned 99–100% confidence and produced verified tracked edits. Two OpenAI calls also completed with measured usage. These are single-run observations, not comparative-speed or legal-accuracy claims.

The 95% automatic threshold is retained; 70% remains the escalation boundary. A smaller batch produced a spurious liability finding on a renewal paragraph at 97% confidence. The exact-template guard prevented an automatic edit. Full-document results differed: the actual liability clause returned 99%, while adjacent explanatory language remained uncertain. This demonstrates why confidence alone cannot authorize a document operation and why this fixture is not an accuracy benchmark.

The ambiguous data provisions remained unresolved (including a NEEDS_REVIEW decision at 31% confidence). Short order-form cross-references also remained unresolved. Draft scheduling now prioritizes substantive uncertainty over those short labels; all original model decisions stay visible.

Published preview smoke check passed: anonymous page load, sample readiness, download, re-upload and explicit unavailable-provider behavior. No browser page errors. A separate fresh clone passed npm ci, typecheck, core tests and a production build.
