# Negotiation workflow verification

The v2 scenario is a fictional, guided counterproposal spanning three known locations. It does not claim exhaustive dependency discovery, legal accuracy, cross-reference repair, or multi-user collaboration.

## Evidence

- SuperDoc 2.16.0; TypeSafe SDK 0.6.0; Jev `jev-1.13.0`.
- Fixture built from retained explicit OOXML parts using Open XML SDK 3.4.1. Office 2019 schema validation passed: `fixture-validation-v2.json`.
- Real local Jev run: three judgments per review; 1,828 input / 183 output tokens before a manual edit, then 1,846 / 183 afterward. The three measured provider calls took 299, 147, and 127 ms. These are individual observations, not performance or legal-accuracy claims. The final fixture adds an explicit definition of the schedule obligations; its hosted recording has separate measurements.
- Actual UI run: counsel overlap → explicit accept → fresh review → direct human edit → stale proposal blocked → fresh review → three verified tracked edits → individual accept/reject → inconsistency notice → downloaded DOCX. No page errors were observed.
- Native Microsoft Word for Mac 16.113.1 opened the corrected export without a repair prompt. The order-form redlines and explanation comment were visually inspected. A saved Word copy preserved all five comment texts/authors, six insertions, six deletions, revision authors, three tables, and three numbered paragraphs. Word reordered comment records. Exact file hashes and comparisons: `word-roundtrip-v2.json`. This was not an exhaustive page-by-page layout audit.

## Repeatable checks

`npm test` covers confidence boundaries, NEEDS_REVIEW, human-approved fallbacks, unsupported and duplicated phrases, full distributions, provider errors, authorization, and concurrent budget enforcement.

`npx playwright test` uses the real pinned editor. Negotiation scenarios cover:

1. Atomic tracked edits in a body clause, table cell, and schedule; existing counsel history; anchored comments; export/reopen with revisions, tables, comments and Word numbering.
2. An invalid plan leaves the document unchanged; a stale plan cannot overwrite a manual edit.
3. Accepted work survives a selective rerun; remaining suggestions do not duplicate; edits to a pending clause block rerun.
4. Provider failure leaves the document untouched; mobile controls fit the viewport.

The legacy playbook tests remain at `/playbook`. Test-only transport failures and decisions are isolated in test files. The application and video scripts cannot enable simulated model results.

Run `npx tsx scripts/check-negotiation-live.mts` for a genuine three-review UI check. It consumes the normal hourly allowance and saves measurements and screenshots under ignored `outputs/negotiation-live`. Use `DEMO_BASE_URL` to choose the hosted origin. The release recording similarly uses `scripts/record-negotiation.mts`.

## Word compatibility issue found during development

An initial fixture used the legal `ns0` prefix for the Word namespace in `comments.xml`. SuperDoc 2.16.0's export added `w:` attributes/elements without binding that prefix in the imported part, producing a malformed comments part and a Word repair prompt. The fixture now uses the conventional `w` prefix and its exported parts parse correctly; the corrected export opened normally in Word.

This is a fixture workaround, not an engine fix or a compatibility guarantee for arbitrary documents. The failing original export and repaired Word copy are retained locally in `outputs/negotiation`; canonical-prefix fixture inputs are tracked in `fixtures/negotiation`. No message or ticket has been sent to Andrii. A focused handoff can use those exact inputs and the pinned version if this edge case needs an engine fix.
