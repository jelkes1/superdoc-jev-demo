# Verification record

Verified locally on 2026-09-22 UTC with Node 24.11.1, SuperDoc 2.16.0 and Playwright Chromium (Playwright 1.58.2).

- `npm ci`: clean dependency installation passed after repairing the generated lockfile.
- `npm run typecheck`: passed.
- `npm run lint`: passed after the editor lifecycle annotation was clarified.
- `npm test`: 12 tests passed, including real local D1 transactions under concurrent requests.
- `npm run test:browser`: 7 browser tests passed in 55.5 seconds. This is test-suite duration, not a model latency claim.
- `npm run build`: production build passed. The CSS optimizer reports warnings about the standards-based `::highlight()` selectors in SuperDoc’s stylesheet, and the editor creates a large client chunk.
- `npm run db:init`: initial local D1 schema applied successfully.
- Fictional DOCX rendered to 14 PDF pages; representative main-contract and appendix pages inspected.
- Real tracked replacements were accepted/rejected, rerun and exported. Reopening the DOCX preserved the replacement revision, all three tables and numbered section headings.
- Build output scanned for the configured model credential: no matches.
- `npm run video:record` refused to record because Jev is not configured, as intended.

The UI orchestration tests use test-only response fixtures; the document operations and export/reopen checks use the real SuperDoc engine. No mocked response mode ships in the application. These tests do not verify Jev’s judgments, reasoning quality or legal accuracy.

Still required: real Jev access; live three-rule proof and five-rule threshold tuning; hosted live review; a genuine recording and visual inspection of both final video cuts. OpenAI configuration is present but reasoning through the complete live review flow remains unverified.

Published preview smoke check passed: anonymous page load, sample readiness, download, re-upload and explicit unavailable-provider behavior. No browser page errors. A separate fresh clone passed npm ci, typecheck, core tests and a production build.
