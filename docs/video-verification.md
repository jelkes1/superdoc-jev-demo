# Video verification

Recorded on 2026-09-22 from the public demo, using Playwright Chromium 145.0.7632.6 (Playwright 1.58.2), Node 24.11.1. These are genuine provider runs. No results are mocked or replayed. The recorder observes cloned fetch responses without changing the app’s request or response.

The main sequence asserts live review completion, a verified liability redline, an ambiguous customer-data finding, a 24-month policy rerun, payment acceptance, renewal rejection, download and navigation after acceptance. The exported file was reopened and checked separately. The social cut uses the opening, live review, redline, verification and closing footage.

Both files are H.264 MP4 at 1600 × 1080, 30 fps. There is no audio stream. Captions are burned in, with separate SRT files. Compressed waiting periods are labeled. FFmpeg 6.0 encoded the cuts; the bundled SuperDoc video reader used FFmpeg 6.0 and ffprobe 4.4 to inspect the containers and extract frames.

## superdoc-jev-demo.mp4

74.9 seconds; 3,998,038 bytes. SHA-256: `6325b9fa2c6cf60e11ca2e9df6bd4a3317257c6045efe6576e464a5d9cf07e64`.

Inspected times: 0.000s, 10.008s, 17.023s, 23.052s, 29.092s, 37.400s, 42.966s, 50.932s, 58.858s, 65.858s, 74.800s.

## superdoc-jev-social.mp4

26.1 seconds; 1,754,885 bytes. SHA-256: `3fc586ed0f14ff9638809fe70f6d819f1ef45adb131c700856322f30e2e998e1`.

Inspected times: 0.000s, 7.003s, 13.000s, 26.000s.

The sampled pixels show readable captions, the 18-to-12-month tracked replacement and revision comment, verification status, unresolved customer-data review with a reasoning draft, the visible 24-month setting, accepted payment terms and rejected renewal status. The closing frame shows the accepted payment text and measured results. The social samples show the decision-to-redline moment and the time-compression label.

This is limited frame inspection. Unseen intervals and every extracted image’s path, bytes, timestamp, original hash and image hash are recorded in [video-verification.json](video-verification.json). Frames remain in the local ignored outputs directory. The JSON uses repository-relative paths; it does not imply those private inspection artifacts are downloadable from GitHub. PNG format, dimensions and hashes were checked with Pillow; native image viewing supplied the visual findings. No audio was omitted because neither file contains audio.

The downloaded final agreement has no unresolved tracked revisions because the demonstrated payment and renewal suggestions were explicitly resolved and the liability proposal was removed by the 24-month rerun. A separate browser export/reopen test verifies preservation of unresolved tracked revisions. See [recorded-export.json](recorded-export.json) and [verification.md](verification.md).
