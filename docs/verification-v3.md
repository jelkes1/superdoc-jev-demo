# Living Deal Desk verification

This is a bounded developer demonstration using a fictional agreement. No legal-accuracy or comparative-speed claim is made.

## Executed locally

- 17 unit/integration checks: routing boundaries, bounded templates, exact cache invalidation, provider failures, malformed responses, reservation settlement and concurrent D1 budget enforcement.
- 15 browser scenarios passed across v1/v2/v3 with the real SuperDoc engine, including a human-approved reasoning replacement and numbered-insertion export/reopen test.
- Existing revision fingerprints survive clause and table-cell replacements. A numbered insertion can be accepted or rejected. Duplicate insertion, stale targets and modified pending suggestions are blocked.
- A changed clause invalidates its judgment; an unchanged recheck makes no model request. Context and policy changes also invalidate the cache.
- Live browser run: eight initial Jev decisions, six changed-context decisions, one OpenAI draft, no browser errors. See `measured-v3.json` for actual confidence, distribution, usage and provider-call timing. Provider-call latency is not end-to-end completion time.
- Live Node SDK run with explicit approval: four verified tracked replacements and four read-back explanation comments. Its default mode keeps the ≥95% gate; no qualifying edits is a valid result.
- Headless output reopened in the browser with six comments, three tables and the preserved counsel revisions.
- Fresh checkout: `npm ci`, typecheck, all 17 unit/integration tests, production build, D1 initialization and local production startup passed. The no-key status correctly reports unavailable providers.
- Desktop (1600px) and mobile (390px) renders inspected.
- Fixture validated with Open XML SDK 3.4.1: zero errors. Exact fixture hash and validator metadata are in `fixture-v3.json`.

## Microsoft Word

The exported five-proposal DOCX opened in native Microsoft Word without a repair prompt. Word showed the revised table, tracked text, comments and numbered schedule. The Mac locked before the planned save-and-reopen round trip; that check is incomplete. The browser export/reopen check is separate and must not be described as a completed Word round trip.

## Deliberate limits

Eight supplied anchors, not general dependency discovery. English text DOCX up to 10 MB/25,000 extracted tokens. Unsupported and incomplete locations remain unresolved. The guided workflow exposes a training policy and renewal notice; the original five-rule review remains at `/playbook`.

Batches execute sequential guarded operations, not a single atomic transaction. Native-editor changes or partial resolution of an owned proposal conservatively block policy replacement; the coordinated Accept/Reject controls are in the demo panel. A missing safeguard always needs approval. Reasoning drafting for the telemetry exception is supported under the consent policy. Model confidence is a provider output, not a calibrated legal-accuracy guarantee.

## Public recording

Recorded the public deployment of application commit `97ec2add10f1c822ff4d631bc9e38ea79d659927` in Playwright Chromium 145.0.7632.6. All twelve recorded steps passed without browser errors. The 65-second main video and 25-second social cut have burned captions and separate SRT files. This run required no time compression; the closing frame is held. The social cut is selected highlights.

The actual recording made eight initial Jev judgments (125 ms provider call), six changed-context judgments (106 ms), and one OpenAI draft (6,778 ms). These are individual observed calls, not benchmarks. See `recorded-run-v3.json` for token usage and complete decision distributions. Review authorization tokens are excluded.

The recorded exported DOCX reopened in SuperDoc with three tables, six comments, five remaining revision groups (two counsel and three agent), and the inserted numbered safeguard. One agent proposal had been accepted, another rejected. Exact video hashes, sampled-frame findings and unviewed intervals are in `video-verification-v3.json`.

[Public demo](https://superdoc-jev.superdoc-1393.chatgpt.site/) · [Release assets](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.3.0)
