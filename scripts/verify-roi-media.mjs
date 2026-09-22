/** Bounded visual samples and technical audio checks. No claim of full audiovisual inspection. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
const out = resolve("outputs/roi-film"),
  ffmpeg = process.env.FFMPEG_PATH || "ffmpeg",
  ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const manifest = JSON.parse(
  await readFile(join(out, "film-manifest.json"), "utf8"),
);
const hash = async (f) =>
  createHash("sha256")
    .update(await readFile(f))
    .digest("hex");
const run = (bin, args) => {
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 8e6 });
  if (r.status !== 0) throw Error(r.stderr);
  return r;
};
const report = {
  reader:
    "Existing FFmpeg/FFprobe for targeted scene samples and loudness checks; source hashes checked before/after. Bundled video-tools preprocessing is retained separately in inspection/bundled.",
  films: [],
  audioGap:
    "No existing local speech-to-text model was available. Native audio input is unsupported. Narration text is the supplied synthesis script; speech was not independently heard/transcribed. No hosted transcription was requested.",
  visualStatus: "pending image inspection",
};
for (const film of manifest.films) {
  if ((await hash(film.file)) !== film.sha256) throw Error("Hash mismatch");
  const metadata = JSON.parse(
    run(ffprobe, [
      "-v",
      "quiet",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      film.file,
    ]).stdout,
  );
  const v = metadata.streams.find((x) => x.codec_type === "video"),
    a = metadata.streams.filter((x) => x.codec_type === "audio");
  if (
    v.width !== 1080 ||
    v.height !== 1350 ||
    v.codec_name !== "h264" ||
    a.length !== 1 ||
    a[0].codec_name !== "aac" ||
    Math.abs(Number(metadata.format.duration) - film.duration) > 0.08
  )
    throw Error("Unexpected media encoding");
  const dir = join(out, "inspection", film.name);
  await mkdir(dir, { recursive: true });
  const frames = [];
  for (const s of film.segments) {
    const time = (s.start + s.end) / 2,
      path = join(dir, `${String(time).replace(".", "_")}-${s.id}.png`);
    run(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(time),
      "-i",
      film.file,
      "-frames:v",
      "1",
      path,
    ]);
    const b = await readFile(path);
    frames.push({
      time,
      path,
      sha256: await hash(path),
      bytes: b.length,
      format: "PNG",
      width: b.readUInt32BE(16),
      height: b.readUInt32BE(20),
      objective: `Inspect ${s.id} legibility, branding, source evidence and clipping.`,
      status: "awaiting visual read",
    });
  }
  const audio = join(dir, "audio-mono-16k.wav");
  run(ffmpeg, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    film.file,
    "-map",
    "0:a:0",
    "-ac",
    "1",
    "-ar",
    "16000",
    audio,
  ]);
  const loud = run(ffmpeg, [
    "-hide_banner",
    "-i",
    film.file,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json",
    "-f",
    "null",
    "-",
  ]).stderr;
  const level = JSON.parse(loud.slice(loud.lastIndexOf("{")));
  if (Number(level.input_tp) > -0.8)
    throw Error("Audio peak exceeds technical ceiling");
  report.films.push({
    file: film.file,
    sha256: film.sha256,
    metadata,
    frames,
    unseenIntervals:
      "Only the listed instants were visually sampled; all intervals between frames remain uninspected.",
    audio: {
      path: audio,
      sha256: await hash(audio),
      streamIndex: a[0].index,
      extraction: "ok",
      transcription: "tool-unavailable",
      loudness: level,
    },
  });
  if ((await hash(film.file)) !== film.sha256) throw Error("Input changed");
}
await writeFile(
  join(out, "media-verification.json"),
  JSON.stringify(report, null, 2),
);
console.log(
  "Encoding, exact durations, audio streams and peaks verified; inspect the retained frames next.",
);
