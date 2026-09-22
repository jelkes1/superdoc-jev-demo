# Developer film

The social story starts with the Word result. It then exposes the boundary a developer can reuse: Jev returns a clause decision, a human approves language, application code chooses a guarded SuperDoc operation, and the resulting edit is verified and reviewable.

## Inspiration

[Jordan Bryan’s LinkedIn post](https://www.linkedin.com/posts/jordanpbryan_this-past-weekend-our-team-was-granted-early-activity-7508165530931871745-sldU) describes a hybrid document-editing architecture using Jev, an LLM, and Version Story’s document processing. Its useful creative idea is to connect a simple developer interface to a concrete edited file and explain the division of responsibility. The public post text was read; LinkedIn subsequently presented an account challenge, so attached media was not inspected. We did not reproduce its comparative speed claim or infer a shared benchmark.

## Cuts

- **Developer story: 60 seconds, 1080 × 1350 (4:5), 30 fps.** Result first, actual Jev decision, tracked replacement, table edit, numbered insertion, preserved counsel revision, human review, the API call, measured proof and repository CTA.
- **Feed cut: 25 seconds, same format.** Immediate redline, document execution, table edit, preserved revision, measured proof and CTA.
- Both are silent and understandable from the on-screen narrative. Separate SRT files are supplied. Oversized type, tightly cropped footage and a restrained navy/mint palette make the content legible in a feed. The first frame already shows the product result; captions and editorial copy do not cover it.

## Evidence and editing

The source is the genuine v4 production recording at application commit `ecb157f`. Jev/OpenAI responses and document operations were real. The five-operation proof card uses the recorded state at export: 6.4556 seconds active processing and $0.000156912 estimated review model cost, excluding human pauses, comparison and the later policy recheck. Source data remains in `docs/recorded-run-v4.json`.

Additional footage opens the exact previously verified export and navigates to counsel’s retained payment concession. Assertions check two counsel revisions, three tables and six comments. This supplemental recording makes no model calls. Its browser/runtime and file hashes are retained in the film manifest.

These are edited highlights, not recordings of elapsed wall-clock performance. Clips are cropped, modestly enlarged and may hold their final frame. The renderer applies a subtle 2% camera move to document footage and short entry fades between scenes. It never changes the document text or replaces real application footage with generated UI. Decision, code and measurement cards are clearly editorial presentations derived from actual responses and source code. The code excerpt renames the receipt variable for clarity; the API and options match the implementation. Full target/capability/revision checks and verification remain in the linked module.

[Verification evidence](developer-film-verification.json) lists every sampled timestamp, original/derived hashes, video properties and unseen intervals. Ten scene frames from the 60-second story and six from the 25-second feed cut were visually inspected. Existing FFmpeg/FFprobe tools selected precise scene timestamps; PNG headers, dimensions and hashes were checked with the Python standard library. A sampled frame inspection is not a claim to have watched every intervening frame. The existing specimen’s native Word round trip and export reopening checks remain documented separately.

## Reproduce

```sh
# With the local demo running and the verified v4 recording/export retained:
npx tsx scripts/record-social-detail.mts
FFMPEG_PATH=/path/to/ffmpeg node scripts/render-social-film.mjs
```

Inputs live in ignored `outputs/video-v4-final`. Outputs, cropped footage, artwork, SRTs and source manifests live in ignored `outputs/social-film`. Rendering requires the existing Playwright Chromium installation and FFmpeg with libx264; it makes no provider calls. Scene artwork uses the repository’s bundled Geist fonts.

## LinkedIn draft — UNSENT

Jev can tell your agent which clause needs attention. SuperDoc gives it a way to change that clause inside a real Word document.

We built a runnable example around a negotiation already in progress: an agreement, an order form, numbered safeguards, and counsel’s existing revisions.

Jev checks the clauses. A person approves the proposed language. Application code uses SuperDoc to create tracked edits at the right document targets, then checks the resulting text and revisions.

The interesting part is what survives: editable tables, numbering, existing counsel revisions, and a Word file someone can accept, reject and pass to the next reviewer.

One recorded run produced 5 verified document changes in 6.46 seconds of active processing, at an estimated $0.000157 in review model cost. Human pauses and the optional model comparison are excluded. These are document-execution measurements from a fictional example, not legal-accuracy claims.

The example includes the operation guards, verification receipts, model comparison and local setup. Try it, inspect the code, and use the integration in your own document-agent experiments.

Demo: https://superdoc-jev.superdoc-1393.chatgpt.site/
Code: https://github.com/jelkes1/superdoc-jev-demo

## X draft — UNSENT

Jev decisions → SuperDoc Word redlines → human review.

Real clause/table edits. Preserved counsel revisions. A downloadable DOCX.

Try the demo and inspect the TypeScript integration:
https://superdoc-jev.superdoc-1393.chatgpt.site/
https://github.com/jelkes1/superdoc-jev-demo

No social posts, comments, messages or outreach were sent.
