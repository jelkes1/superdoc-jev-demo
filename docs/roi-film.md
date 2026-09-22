# Branded ROI films

The V5 release contains a 60-second narrated walkthrough and a 25-second instrumental social cut, each at 1080 × 1350, 30 fps, with H.264 video, AAC audio, readable on-screen captions, a matching SRT file, and a first-frame cover. The official SuperDoc logo remains visible. Typography is Inter and JetBrains Mono; the blue accent is #1355FF.

## Story and sources

The opening frame shows a real tracked clause replacement. The sequence moves through a table-cell redline, an approved numbered safeguard, three pinned decision models using the same SuperDoc execution, equivalent outcomes, time/cost differences, human review, and reusable code.

The comparative figures are the retained five-run-per-model local benchmark, not a selected fastest hosted run. The baseline is explicitly **GPT-5.4 mini + SuperDoc**. The cards use `reduction` from `lib/workflow/types.ts` and display formatters shared with the website. The 60-second film shows the projected $7.32 difference at 10,000 equivalent runs; it does not infer human-time or lawyer-hour savings.

- 1.176 seconds less median processing, displayed as 1.18s / 24.4%.
- $0.000732288 less estimated model spend/run, displayed as $0.000732 / 82.4%.
- All 15 complete runs: five matching verified operations, zero failed operations, two unresolved findings, pre-existing counsel revisions preserved.
- Reported cached-input discounts are included. Prices dated September 22, 2026.
- See [complete methodology](workflow-roi-methodology.md) and [all results](workflow-evaluation-v1.json).

The application footage is genuine hosted interaction, with no response mocks, simulated typing, or generated application screens. Editorial benchmark/code cards are explicitly separate from the application footage. Shots are cropped for legibility; pauses are removed and selected frames held. “Edited highlights · pauses shortened” is displayed. Video playback is not a wall-clock benchmark.

## Audio

The long film uses the standard OpenAI Cedar voice with `gpt-4o-mini-tts-2025-12-15`, credited as AI-generated narration. The short film uses an original restrained synthesized instrumental. Its composition and resulting audio are [CC0](../assets/audio/LICENSE.md), with no third-party samples or artist imitation. The longer cut targets −16 LUFS and the instrumental cut −23 LUFS, both with −1.5 dBTP ceilings. The scripts preserve individual narration segments and their supplied text.

## Reproduce

With the local example installed and provider credentials configured privately:

```sh
npm run video:roi:record       # genuine hosted calls; observes public usage limits
npm run video:roi:narrate      # uses the existing OpenAI key; separately billed audio
python3 scripts/compose-roi-music.py
# FFmpeg and FFprobe must already be available, or supply FFMPEG_PATH / FFPROBE_PATH.
npm run video:roi:render
```

Generated files live under ignored `outputs/roi-film/`. The recorder retains the source WebM hash, browser version, shots, actual responses, downloaded documents, and assertions. It confirms the working DOCX's document, comments and numbering parts are unchanged by comparison. The renderer refuses unmatched benchmark results or an unsuccessful hosted capture, and verifies that the source recording did not change during rendering.

Reopen hosted comparison outputs using the same browser extraction checks:

```sh
WORKFLOW_EXPORT_DIR=outputs/roi-film \
WORKFLOW_EXPORT_SUFFIX=-hosted.docx \
WORKFLOW_VERIFICATION_OUTPUT=docs/hosted-workflow-export-verification.json \
npm run verify:workflow-exports
```

Inspect the rendered files before sharing. Release verification records distinguish sampled visual checks, encoding/audio measurements, and anything not independently heard or transcribed. Social and outreach drafts remain unsent.
