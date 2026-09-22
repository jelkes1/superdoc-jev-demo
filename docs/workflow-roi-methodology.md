# Full-workflow ROI: Jev and OpenAI with the same SuperDoc engine

This comparison starts with a loaded fictional Word agreement and ends with verified, pending Word redlines. The models judge the same eight clause locations. SuperDoc 2.16.0 supplies the same extraction, tracked replacements, numbered insertion, preservation checks, and export for every model.

## What is held constant

`fixtures/workflow/expected.json` freezes the original DOCX hash, complete clause evidence, default policy, the four replacement texts, the numbered safeguard, and the expected preserved/unresolved locations. It was committed before provider calls. A visitor approves the replacement language for independent comparison copies and separately selects the numbered safeguard. The active working document is untouched.

The model snapshots are `jev-1.13.0`, `gpt-5.4-mini-2026-03-17`, and `gpt-5.4-2026-03-05`. OpenAI uses reasoning effort `none`, strict verdict JSON, standard tier and a 2,000-token output ceiling. Calls are fresh, with no application cache, retries, or substitutions. Actual provider-reported cached input is discounted. Jev's native confidence remains visible in the response, but approved comparison operations do not fabricate a corresponding OpenAI confidence.

A replacement is attempted only for an `UNACCEPTABLE` judgment and a supported, approved target. The separately approved missing safeguard is a common human instruction in every copy; it does not depend on a model confidence score. Unsettled telemetry and liability positions remain for human review. No reasoning draft is part of this bounded comparison. Existing review and drafting behavior is unchanged.

The three workflows run sequentially. Repeated local evaluation rotates the first model, with five repetitions per model. Every copy starts from the same original bytes. The comparison snapshot binds the document hash, policy/version, canonical evidence/questions, approved-language hash, and safeguard selection.

## Time and cost

A browser timer starts immediately before extraction in the ready editor and ends after final document verification. Extraction, the complete decision request (including transport), and SuperDoc execution/verification are components, not additional totals. Initial document loading, approvals, other models' lanes, and exporting/downloading are excluded. Backgrounding the tab invalidates time-savings claims for that lane. Human time and lawyer hours are not measured.

Reported token counts are multiplied by the versioned pricing in `lib/compare/pricing.ts`; this is estimated model spend, not an invoice or total project cost. SuperDoc licensing, hosting, human review, and video production are excluded. Unknown costs remain unknown.

For a chosen OpenAI baseline:

- Absolute difference = baseline value − Jev value.
- Percentage reduction = absolute difference / baseline value × 100.
- Negative values are explicitly shown as longer processing or higher cost.
- Zero baseline denominators and unknown values have no percentage.
- Calculations use unrounded values; display rounding is applied last.

Savings require the same frozen snapshot and approved operation set, complete provider results, all expected operations verified, no failures, identical resulting target text/operation kinds and unresolved locations, and preserved pre-existing revisions. Matching edit counts alone are insufficient. This equivalence describes document execution, not legal accuracy. Failed or different outcomes remain visible with their costs and timings.

The monthly volume control defaults to 10,000 equivalent runs. Its live projection uses the measured cost of one run per model; the published evaluation reports mean cost across all repetitions. It is explicitly a workload projection, not a volume discount or a prediction for different contracts.

## Reproduce

```sh
npm ci
cp .env.example .dev.vars
# Privately configure TYPESAFE_API_KEY and OPENAI_API_KEY.
npm run dev
# In a second terminal, with the local demo ready:
npm run eval:workflow
```

The CLI requires the frozen fixture to be committed and unchanged. It uses the browser integration and shared real provider adapters through a local Playwright bridge. Bridge overhead is included in decision-request time; hosted comparisons use HTTP and should be measured separately. No hosted quota is bypassed. The script holds a conservative maximum before each three-model round, reconciles reported usage, and stops at a $2 cap. Run one evaluation process at a time against that intended cap. Results persist after each completed model; missing and incomplete runs remain visible. Browser-local fictional exports are written under `outputs/workflow-evaluation`.

## Hosted usage controls

`POST /api/compare/workflow/start` reserves all three maximum costs atomically and consumes one shared review allowance. The model endpoint checks the visitor, snapshot, expiry, and a single-use provider slot before calling the model. Usage settles independently per provider. Finish/cancel closes unclaimed slots; started calls with unknown usage retain their reservation. Expiry is reconciled on subsequent start/model traffic. The ordinary two-draft reasoning allowance is independent.

D1 stores only snapshot hashes, reservation/slot states, expiry, identity hashes, and numeric accounting. Inputs, output DOCX files, decisions and operation receipts remain in browser memory. Server logs do not contain contract text.

## Results and interpretation

See `workflow-evaluation-v1.json` for every repetition, exact responses, timings, usage, and operation receipts. These are small fictional demonstration results from one client/session; the summary includes ranges, failures, unknown costs, and equivalent-outcome counts. They do not establish general legal accuracy or a product-wide performance guarantee.

The earlier 85.7% lower median decision latency and 94.4% lower estimated model spend versus GPT-5.4 mini belong only to the separate classification evaluation in `comparison-methodology.md`. They are not reused as full-workflow claims.

## Recorded full-workflow results — September 22, 2026

All 15 workflows completed, each producing the same five verified edits and preserving counsel’s revisions. All 15 exports reopened with their exact target text, three tables, four numbered items, tracked revisions, and the safeguard’s anchored comment. See [export checks](workflow-export-verification.json).

| Model | Active processing median [range] | Mean model cost/run | Equivalent outcomes | Failures / unknown costs |
| --- | --- | --- | --- | --- |
| jev-1.13.0 | 3.64s [3.61–3.68s] | $0.000156912 | 5/5 | 0 / 0 |
| gpt-5.4-mini-2026-03-17 | 4.82s [4.72–5.53s] | $0.000889200 | 5/5 | 0 / 0 |
| gpt-5.4-2026-03-05 | 5.12s [4.52–5.53s] | $0.002964000 | 5/5 | 0 / 0 |

Against GPT-5.4 mini, Jev reduced median active processing by **1.176 seconds (24.4%)** and mean estimated model cost by **$0.000732288 per run (82.4%)**. Against GPT-5.4, the differences were **1.4734 seconds (28.8%)** and **$0.002807088 per run (94.7%)**. Reported OpenAI cache discounts are included. These percentages compare medians for timing and mean costs for spend across the complete matched sample.

The conservative microdollar ledger charged $0.020055 against the $2 cap. The raw response token-price estimates retain additional precision.
