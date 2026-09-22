# Video production

The [v0.2.0 release](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.2.0) contains a 75-second captioned negotiation walkthrough, a 25-second social cut, SRT captions, measured responses, and the exact downloaded Word file. Both cuts use genuine hosted Jev responses and actual SuperDoc operations. They contain no simulated responses, voiceover, or review-time compression.

```sh
DEMO_BASE_URL=https://your-public-demo.example npm run video:negotiation
VIDEO_OUTPUT_DIR=outputs/video-v2 npm run video:render
```

Requires Playwright Chromium and FFmpeg with subtitles support. Set `FFMPEG_PATH` if necessary. The script consumes three reviews under the normal public limits, uses the fictional sample only, and preserves raw footage and responses in ignored `outputs/video-v2`. It asserts the stale-proposal pause, verified redlines, individual human decisions, and download. The renderer rejects incomplete negotiation runs. Inspect actual encoded durations with FFprobe; timeline arithmetic alone is insufficient.

## Main sequence

| Beat | What the viewer sees |
| --- | --- |
| Returned agreement | Existing counsel revisions and comments |
| Deal instruction | General and data-protection caps connected across three known locations |
| Live review | Actual Jev judgments |
| Counsel overlap | Human explicitly resolves the overlapping revision |
| Prepared proposal | Preview based on current document state |
| Human edit | A sentence added to the liability clause |
| Conflict guard | Old proposal paused; human sentence remains |
| Fresh review | Proposal rebuilt against the updated text |
| Connected redlines | One atomic tracked plan updates clause, table and schedule |
| Human decisions | Accept one edit, reject another; inconsistency remains visible |
| Word export | Download with comments and unresolved revisions |

The social edit selects and reorders highlights: opening, connected redlines, table redlines, conflict guard, export. The main cut excludes initial loading and holds the closing frame to reach 75 seconds. Neither cut accelerates a review.

## Verification

Recorded from the public demo using Playwright Chromium 145.0.7632.6 at 1600 × 1080. Twelve main-cut frames and five social-cut frames were visually inspected, including the redlines, conflict state, human decisions, and closing state. `video-verification-v2.json` records exact hashes, sampled times, unread intervals, tools, and limitations. Sampled stills do not establish every intervening frame. Assertions and the inspected DOCX provide stronger evidence than captions.

`measured-v2.json` retains all nine judgments from the three provider calls, full distributions, separate confidences, usage and provider-call timing. These are observations from one guided run, not legal-accuracy or performance benchmarks.

The exact recording export opened in Microsoft Word for Mac 16.113.1 without repair. A separately saved Word copy preserved its remaining redlines, comments, three tables, three numbered paragraphs and the human-added sentence. See `word-recording-roundtrip-v2.json`; this was not a page-by-page layout audit.

## Original playbook video

`npm run video:record` retains the five-rule flow: review, liability redline, ambiguous escalation, cap change, selective rerun, human review and export. Render with `npm run video:render` (default `outputs/video`). Its [v0.1.0 videos](https://github.com/jelkes1/superdoc-jev-demo/releases/tag/v0.1.0), measurements and inspection receipts remain available. Any shortened waits in that recording are explicitly captioned.
