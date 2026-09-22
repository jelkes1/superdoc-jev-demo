# Measurements and comparison methodology

The primary outcome is **verified Word operations · active processing time · estimated model cost**. Verification means exact-target text readback, newly created tracked revisions and preserved pre-existing revisions. It is document-execution evidence, not legal accuracy. Comments have a separate verification count. One replacement can create multiple OOXML revision fragments and still counts as one operation.

## This run

`lib/deal-desk/measurements.ts` records non-overlapping browser intervals for extraction/review/validation, optional drafting, and SuperDoc execution/verification. Human reading and approval pauses, initial editor loading, comparison and file download are excluded. Time to first verified edit is the sum of active time up to the first successful verification. The displayed Jev and reasoning times are provider-call subspans within these intervals, not extra time added to the total. Revision/policy metadata accompanies each interval and usage record. Accepted/rejected operations remain part of this run's history; reset/opening another document starts a new run.

Input/output usage accumulates across reviews, rechecks and drafts. A no-change recheck performs extraction/cache validation but makes no provider call. Failed requests without reported usage are shown as unknown, never zero-cost successes. Estimated prices are versioned at 2026-09-22, using reported cached-input counts when present:

| Model | Input / 1M | Cached input / 1M | Output / 1M |
| --- | ---: | ---: | ---: |
| jev-1.13.0 | $0.042 | $0.042 | $0 |
| gpt-5.4-mini-2026-03-17 | $0.75 | $0.075 | $4.50 |
| gpt-5.4-2026-03-05 | $2.50 | $0.25 | $15 |

Sources: [TypeSafe models](https://docs.typesafe.ai/models), [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4). These are token-price estimates, not invoices. Optional reasoning keeps the existing `gpt-5.4` configuration with low reasoning effort, separately from the pinned comparison snapshots.

## Optional live comparison

`POST /api/compare` accepts the same bounded revision/policy/row evidence shape as `/api/deal-desk`. The comparison action directly starts the request. Provider handling is described in the supporting **Data & limits** information; no acknowledgment checkbox or consent header is required. The server freezes a SHA-256 identity over document revision, policy version and canonical task. All models receive identical clause evidence, policy questions and four answer choices. Provider-specific transport envelopes differ: Jev's native choices versus OpenAI's strict verdict JSON. General models are not asked to invent confidence or distributions. Only Jev displays its native confidence and full distribution.

The exact three models run concurrently, with fresh requests, no application cache, no retries or substituted models. OpenAI uses `reasoning_effort: none`, standard tier, `store: false` and a 2,000-token output ceiling. Each provider has a 60-second timeout. Elapsed provider time includes transport, returned-body parsing and validation. Each real result appears when it completes; unavailable/incomplete responses remain visible. Unknown pricing is not replaced with zero. Disagreements compare returned labels, not legal truth. Comparison results use separate types and cannot enter the automatic-edit logic or alter the document. SuperDoc is the common execution layer demonstrated separately in the walkthrough.

The combined conservative maximum is reserved atomically before any provider calls. A comparison consumes one of the shared five reviews/visitor/IP/clock-hour and the $10/UTC-day allowance. Known provider usage is reconciled; unknown portions remain reserved. The two-draft allowance is independent. Browser memory holds comparison evidence/results; D1 stores only counters/reservation metadata. Disconnecting does not release unreported reservations.

## Reproduce the fictional evaluation

```sh
npm ci
cp .env.example .dev.vars
# Set your two provider keys privately.
npm run eval:compare
```

The CLI reads `fixtures/comparison/expected.json`, requires it to be committed and unchanged, and hashes it before any provider call. Expected verdicts and rationales were frozen in commit `abd6b0b` before the run. Four fictional clause-context variants cover violating, acceptable, ambiguous and missing terms. Each variant has four locations: training, renewal, payment and a safeguard. Five repetitions per variant/model produce 60 requests and 240 expected verdicts. They run in repetition-major order, with the three models parallel within each snapshot. Fresh requests permit provider-managed caching; any reported discount is honored.

The CLI reserves a conservative maximum against a $2 local cap before each batch and reconciles reported usage. Results are written after every batch, including incomplete runs. The hosted allowance does not apply to this local script. Do not run concurrent CLI evaluations against a single intended $2 allowance. No user documents or production-contract evaluation results are published.

## Recorded demonstration results

See [all actual responses](evaluation-v4.json) and [frozen expectations](../fixtures/comparison/expected.json). All 60 requests completed; total reported token-price estimate was **$0.09258122** (conservative microdollar accounting held/charged $0.09261). No unknown usage was reported.

| Exact model | Provider latency median [range] | Total estimated cost (20 requests) | Fixture agreement | Failed/incomplete | Missed violations* | Unresolved marked acceptable |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| jev-1.13.0 | 141 ms [98–304] | $0.00117222 | 79/80 | 0 | 0 | 0 |
| gpt-5.4-mini-2026-03-17 | 986 ms [810–5,039] | $0.021084 | 78/80 | 0 | 0 | 0 |
| gpt-5.4-2026-03-05 | 1,052 ms [852–4,968] | $0.070325 | 71/80 | 0 | 4 | 0 |

*“Missed violation” includes an expected UNACCEPTABLE returned as unresolved, another verdict, or absent. It does not mean an unsafe edit was made: the comparison never edits documents. Per-request median/range costs and disagreements are retained in the JSON. The frozen rationales and every mismatch are inspectable; results were not used to revise labels or rerun only favorable examples.

This is a small, deliberately constructed demonstration dataset, measured from one client and one session. Labels reflect the supplied fictional instructions, not independent legal review. No claim about general legal accuracy, model superiority, real-world error rates or end-to-end product speed follows from it. Latency includes network/service variability; repeat runs may differ. General models were asked to classify, not generate contracts, to keep the compared decision stage bounded.
