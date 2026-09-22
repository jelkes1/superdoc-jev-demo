# Video production

`npm run video:record` records the sample through the actual UI and real server responses. It refuses to record if Jev is not configured and fails if a verified redline or ambiguous finding is missing. It does not intercept network requests or fabricate results.

`npm run video:render` uses FFmpeg (with the subtitles filter) to make a nominal 75-second main cut and 25-second social cut. Captions are burned into the MP4 and supplied separately as SRT. Waiting intervals are shortened only when needed and explicitly captioned **Waiting time compressed**. Raw footage and measured provider results are retained alongside the exports. If the captured sequence falls outside the requested durations, adjust the edit and inspect again.

Run against a verified local or hosted URL:

```sh
DEMO_BASE_URL=https://your-public-demo.example npm run video:record
npm run video:render
```

Use the sample only, never a visitor contract. Recording starts two reviews and may use up to four reasoning drafts, within the normal application limits. It does not bypass the budget or rate limits. Set `VIDEO_OUTPUT_DIR` to choose an output folder and `FFMPEG_PATH` if FFmpeg is not on PATH.

## Main sequence

| Beat | What the viewer sees | Caption purpose |
| --- | --- | --- |
| 1 | Formatted agreement and five-rule playbook | Establish a real Word workflow |
| 2 | Live review and measured responses | Attribute decisions to Jev |
| 3 | Liability cap redline in the document | Make SuperDoc’s role unmistakable |
| 4 | Verification details | Show an actual tracked change |
| 5 | Ambiguous finding | Keep human judgment visible |
| 6 | Cap changed from 12 to 24 months; rerun | Show policy changes without duplicate suggestions |
| 7 | Accept one edit; reject another | Show human control |
| 8 | Download DOCX | Show a usable artifact |

The social cut uses the opening, live review, decision-to-redline, verification and closing beats.

Before publishing, inspect the exported MP4s at the beginning, each state transition, and the end. Confirm readable captions and visible redlines, verify durations and reopen the recorded DOCX. Never distribute a test-transport recording as a live Jev demo. The current external gate is a working TypeSafe API key; final video files have not yet been recorded.
