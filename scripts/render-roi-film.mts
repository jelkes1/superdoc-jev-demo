/** Branded editorial framing around verified footage; figures use the website's shared ROI calculation. */
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { reduction } from "../lib/workflow/types";
import { money, seconds } from "../lib/compare/format";
const out = resolve("outputs/roi-film"),
  ffmpeg = process.env.FFMPEG_PATH || "ffmpeg",
  probe = process.env.FFPROBE_PATH || "ffprobe";
const benchmark = JSON.parse(
  await readFile("lib/workflow/benchmark.json", "utf8"),
);
const source = JSON.parse(
  await readFile(join(out, "hosted-source.json"), "utf8"),
);
const narration = JSON.parse(
  await readFile(join(out, "audio/narration.json"), "utf8"),
);
const jev = benchmark.models[0],
  mini = benchmark.models[1],
  time = reduction(mini.activeMs.median, jev.activeMs.median)!,
  cost = reduction(mini.estimatedCostUsd.mean, jev.estimatedCostUsd.mean)!;
if (
  !benchmark.complete ||
  benchmark.models.some((m: any) => m.equivalentToJev !== 5)
)
  throw Error("Unmatched benchmark cannot support savings.");
if (!process.env.ART_ONLY && !source.passed)
  throw Error("Hosted capture must finish successfully.");
await mkdir(join(out, "art"), { recursive: true });
await mkdir(join(out, "clips"), { recursive: true });
const asset = async (path: string, mime: string) =>
  `data:${mime};base64,${(await readFile(path)).toString("base64")}`;
const logo = await asset("public/brand/superdoc-logo.png", "image/png"),
  regular = await asset("public/fonts/inter-400.ttf", "font/ttf"),
  bold = await asset("public/fonts/inter-700.ttf", "font/ttf"),
  mono = await asset("public/fonts/jetbrains-mono-400.ttf", "font/ttf");
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const pct = (n: number) => n.toFixed(1) + "%";
const scenes: any = {
  hook: {
    dur: 4,
    tag: "DOCUMENT AGENTS → REVIEWABLE WORD FILES",
    title: "Decisions in.<br><em>Word redlines out.</em>",
    sub: "Jev + SuperDoc · a working developer example",
    shot: "redline",
    crop: [350, 636, 750, 260],
    label: "Actual DOCX · tracked clause replacement",
    checks: "✓ Real Word revisions &nbsp; ✓ Human review",
    caption:
      "Your document agent should deliver a Word file people can review.",
  },
  execute: {
    dur: 6,
    tag: "THE DOCUMENT EXECUTION LAYER",
    title: "From an approved clause<br><em>to a verified edit.</em>",
    sub: "Jev decides. SuperDoc executes.",
    shot: "redline",
    crop: [350, 793, 750, 91],
    label: "§ 7.1 · exact target, tracked replacement",
    checks: "✓ Text readback &nbsp; ✓ Tracked revisions &nbsp; ✓ Preservation",
    caption:
      "Jev makes the decisions. SuperDoc creates and verifies real tracked changes.",
  },
  table: {
    dur: 4,
    tag: "STRUCTURE IS PART OF THE OUTPUT",
    title: "Change the terms.<br><em>Keep the table.</em>",
    sub: "The order form stays editable in Word.",
    shot: "table",
    crop: [350, 627, 735, 233],
    label: "Order form · real tracked table-cell replacement",
    checks: "✓ Same table &nbsp; ✓ Editable Word content",
    caption: "Even inside tables. The structure stays editable.",
  },
  safeguard: {
    dur: 5,
    tag: "A NEW CLAUSE, WITH YOUR APPROVAL",
    title: "Insert the safeguard.<br><em>Keep the numbering.</em>",
    sub: "A real list item and an anchored review comment.",
    shot: "safeguard",
    crop: [350, 699, 735, 221],
    label: "Schedule C · separately approved numbered insertion",
    checks: "✓ Numbered insertion &nbsp; ✓ Comment anchored to new text",
    caption: "Add an approved safeguard, with real numbering and a comment.",
  },
  compare: {
    dur: 7,
    tag: "SAME INPUT → SAME DOCUMENT ENGINE",
    title: "Swap the model.<br><em>Hold the work constant.</em>",
    sub: "Same contract. Same approved language. Independent copies.",
    html: `<div class="lanes"><div><b>Jev</b><code>jev-1.13.0</code></div><div><b>GPT-5.4 mini</b><code>2026-03-17 · reasoning none</code></div><div><b>GPT-5.4</b><code>2026-03-05 · reasoning none</code></div></div><div class="engine">↓<br><b>SuperDoc 2.16.0</b><p>Extract → classify → tracked edits → verify</p></div>`,
    caption:
      "Then swap the decision model. Same contract, approved language, and SuperDoc execution. Independent copies.",
  },
  outcomes: {
    dur: 5,
    tag: "RECORDED BENCHMARK · FIVE RUNS PER MODEL",
    title: "15 complete runs.<br><em>The same 5 verified edits.</em>",
    sub: "Four replacements + one approved numbered safeguard.",
    html: `<div class="outcomes">${benchmark.models.map((m: any, i: number) => `<div><span>${["Jev", "GPT-5.4 mini", "GPT-5.4"][i]} + SuperDoc</span><strong>5 / 5 <small>equivalent runs</small></strong></div>`).join("")}</div><div class="proofline">✓ Existing counsel revisions preserved<br>✓ 0 failed edits &nbsp; · &nbsp; 2 unresolved findings per run</div>`,
    caption:
      "Five runs per model. All fifteen produced the same five verified edits.",
  },
  time: {
    dur: 7,
    tag: "JEV + SUPERDOC VS GPT-5.4 MINI + SUPERDOC",
    title: `<em>${seconds(time.absolute)} saved.</em><br>${pct(time.percent)} shorter processing.`,
    sub: "Complete workflow · median of five runs per model",
    html: `<div class="bars"><label>GPT-5.4 mini + SuperDoc <b>${seconds(mini.activeMs.median)}</b></label><div class="bar baseline" style="width:100%"></div><label>Jev + SuperDoc <b>${seconds(jev.activeMs.median)}</b></label><div class="bar" style="width:${100 - time.percent}%"></div></div><div class="proofline">Extraction + request transport + edits + verification</div><p class="caveat">Initialization, human pauses and export excluded.<br>Fictional sample · results vary by workload.</p>`,
    caption:
      "On this fictional sample, Jev cut median processing by 1.18 seconds versus GPT-5.4 mini.",
  },
  cost: {
    dur: 7,
    tag: "JEV + SUPERDOC VS GPT-5.4 MINI + SUPERDOC",
    title: `<em>${pct(cost.percent)} lower</em><br>estimated model spend.`,
    sub: `${money(cost.absolute)} saved per equivalent run`,
    html: `<div class="costs"><div><span>GPT-5.4 mini</span><b>${money(mini.estimatedCostUsd.mean)}</b></div><div class="highlight"><span>Jev</span><b>${money(jev.estimatedCostUsd.mean)}</b></div></div><div class="projection"><span>AT 10,000 EQUIVALENT RUNS / MONTH</span><strong>${money(cost.absolute * 10000)} less</strong><p>Projection from measured mean model costs</p></div><p class="caveat">Five runs/model · reported cache discounts included.<br>Excludes SuperDoc licensing, hosting and human review.</p>`,
    caption:
      "Estimated model spend was 82.4% lower. At 10,000 equivalent runs, that projects to $7.32 saved.",
  },
  human: {
    dur: 7,
    tag: "A REVIEWABLE DOCUMENT IS THE DELIVERABLE",
    title: "Review the redlines.<br><em>Download Word.</em>",
    sub: "Your working agreement remains separate from comparison copies.",
    shot: "human",
    crop: [1245, 352, 320, 241],
    label: "Actual application · Accept / Reject controls",
    checks: "✓ Per-change review &nbsp; ✓ Exportable DOCX",
    caption:
      "Inspect the receipts. Keep counsel’s revisions. Accept or reject each change, then download the Word file.",
  },
  code: {
    dur: 8,
    tag: "BUILD YOUR OWN DOCUMENT AGENT",
    title: "The model decides.<br><em>SuperDoc handles Word.</em>",
    sub: "Runnable TypeScript. Inspectable results. Real DOCX output.",
    html: `<div class="code"><span>lib/deal-desk/document.ts</span><pre>await doc.replace(\n  { target, text: approvedText },\n  {\n    <b>changeMode: "tracked",</b>\n    expectedRevision\n  }\n);</pre></div><p class="caveat">Abbreviated call · full guards and verification in source</p>`,
    caption:
      "Try the live demo, inspect the benchmark, and fork the TypeScript example.",
    cta: true,
  },
  socialroi: {
    dur: 7,
    tag: "JEV + SUPERDOC VS GPT-5.4 MINI + SUPERDOC",
    title: "Same verified edits.<br><em>Less processing. Less spend.</em>",
    sub: "Recorded benchmark · five complete runs per model",
    html: `<div class="socialstats"><div><strong>${seconds(time.absolute)} saved</strong><b>${pct(time.percent)} shorter processing</b><span>${seconds(mini.activeMs.median)} → ${seconds(jev.activeMs.median)} median</span></div><div><strong>${pct(cost.percent)} lower</strong><b>estimated model spend</b><span>${money(cost.absolute)} saved per run</span></div></div><p class="caveat">Fictional sample · matched outputs · cache discounts included.<br>Model spend only. Not a legal-accuracy benchmark.</p>`,
    caption:
      "Same 5 verified edits. 24.4% shorter processing and 82.4% lower estimated model spend versus GPT-5.4 mini.",
  },
};
scenes.compare.html = undefined;
scenes.compare.label = "Actual hosted comparison · independent Word copies";
scenes.compare.checks = "Three files · the same five verified Word changes";
scenes.compare.comparisonStrips = true;
function html(id: string, s: any) {
  return `<!doctype html><style>
@font-face{font-family:Inter;src:url('${regular}')}@font-face{font-family:Inter;src:url('${bold}');font-weight:700}@font-face{font-family:Mono;src:url('${mono}')}
*{box-sizing:border-box}body{margin:0;width:1080px;height:1350px;background:radial-gradient(ellipse at 90% 8%,#eeeaff 0,transparent 48%),linear-gradient(160deg,#f8fbff,#f4f7ff 60%,#fff);font-family:Inter;color:#0f172a}header{position:absolute;left:60px;top:44px;right:60px;display:flex;align-items:center;gap:13px;font-size:32px;font-weight:700}header img{width:42px;height:48px;object-fit:contain}header b{color:#1355ff}header span{font-size:25px;font-weight:400;color:#64748b}header small{margin-left:auto;font:16px Mono;color:#64748b}.tag{position:absolute;left:60px;top:141px;font-size:17px;letter-spacing:1.6px;color:#1355ff;font-weight:700}h1{position:absolute;left:60px;top:179px;margin:0;font-size:${["time", "outcomes", "socialroi"].includes(id) ? 61 : 66}px;line-height:1.09;letter-spacing:-2.4px;max-width:968px}h1 em{font-style:normal;color:#1355ff}.subtitle{position:absolute;left:60px;top:348px;margin:0;font-size:24px;color:#475569;max-width:930px;line-height:1.4}.card{position:absolute;left:60px;top:426px;width:960px;height:576px;border:1px solid #d9e2f4;background:#fff;border-radius:22px;box-shadow:0 16px 45px #1437820a;padding:36px}.label{font:17px Mono;color:#64748b;border-bottom:1px solid #e7edf6;padding-bottom:21px}.checks{position:absolute;left:24px;right:24px;bottom:26px;text-align:center;font-size:22px;color:#1355ff;font-weight:700}.caption{position:absolute;left:60px;right:60px;top:1044px;border-left:5px solid #1355ff;padding:14px 22px;font-size:29px;line-height:1.35;min-height:126px;color:#1e293b;background:#ffffffb3;border-radius:0 12px 12px 0}.footer{position:absolute;left:60px;right:60px;bottom:48px;display:flex;justify-content:space-between;color:#64748b;font-size:16px;line-height:1.5}.lanes{display:flex;gap:16px}.lanes>div{flex:1;padding:23px 16px;background:#f5f8ff;border:1px solid #dfe7ff;border-radius:14px;text-align:center}.lanes b{font-size:26px;display:block}.lanes code{font:13px Mono;color:#64748b;display:block;margin-top:13px}.engine{text-align:center;font-size:54px;color:#1355ff;margin-top:12px}.engine b{font-size:38px}.engine p{font-size:23px;color:#475569}.outcomes>div{display:flex;justify-content:space-between;align-items:center;padding:22px 0;border-bottom:1px solid #e2e8f0;font-size:27px}.outcomes strong{color:#1355ff;font-size:33px}.outcomes small{font-size:18px;font-weight:400}.proofline{font-size:23px;color:#1355ff;line-height:1.7;margin-top:30px}.bars{padding-top:26px}.bars label{display:flex;justify-content:space-between;font-size:26px;margin-bottom:14px}.bars b{font:29px Mono}.bar{background:#1355ff;height:43px;border-radius:8px;margin-bottom:36px}.baseline{background:#b9c7df}.caveat{font-size:18px;line-height:1.55;color:#64748b;margin:23px 0 0}.costs{display:flex;gap:20px}.costs>div{flex:1;background:#f5f7fb;padding:22px 20px;border-radius:12px}.costs span{display:block;color:#64748b;font-size:23px}.costs b{display:block;font:32px Mono;margin-top:12px}.costs .highlight{background:#ecf3ff;color:#1355ff}.projection{margin-top:30px;padding:23px;border:1px solid #b9cfff;border-radius:14px;background:#f9fbff}.projection span{font-size:17px;color:#64748b;letter-spacing:1px}.projection strong{display:block;font-size:50px;color:#1355ff;letter-spacing:-1px;margin-top:8px}.projection p{font-size:20px;margin:7px 0 0;color:#475569}.code{background:#f4f7fe;border-radius:15px;padding:24px}.code span{font:17px Mono;color:#64748b}.code pre{font:25px/1.55 Mono;margin:24px 0 0}.code b{color:#1355ff;font-weight:400}.cta{position:absolute;left:60px;right:60px;top:1189px;display:flex;align-items:center;gap:20px}.cta b{background:#1355ff;color:white;border-radius:10px;padding:15px 21px;font-size:22px}.cta span{font:19px Mono;color:#475569}.socialstats>div{padding:16px 0 24px}.socialstats strong{font-size:51px;color:#1355ff;display:block;letter-spacing:-1.5px}.socialstats b{display:block;font-size:28px;margin-top:4px}.socialstats span{display:block;font:20px Mono;color:#64748b;margin-top:10px}
</style><header><img src="${logo}"><b>SuperDoc</b><span>× Jev</span><small>THE DEVELOPER DEMO</small></header><div class="tag">${s.tag}</div><h1>${s.title}</h1><p class="subtitle">${s.sub}</p><div class="card">${s.html || `<div class="label">${s.label}</div><div class="checks">${s.checks}</div>`}</div><div class="caption">${s.caption}</div>${s.cta ? '<div class="cta"><b>Try it. Inspect it. Fork it. ↗</b><span>github.com/jelkes1/superdoc-jev-demo</span></div>' : ""}<div class="footer"><span>${s.cta ? "AI-generated narration · Cedar / OpenAI" : "Edited highlights · pauses shortened"}</span><span>${["time", "cost", "outcomes", "socialroi"].includes(id) ? "Recorded September 22, 2026 · methodology in repo" : "Real DOCX · real provider calls · SuperDoc 2.16.0"}</span></div>`;
}
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
});
for (const [id, s] of Object.entries(scenes)) {
  await page.setContent(html(id, s));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, "art", `${id}.png`) });
}
await page.setContent(
  html("code", scenes.code).replace(
    "AI-generated narration · Cedar / OpenAI",
    "Original instrumental · CC0",
  ),
);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(out, "art", "code-social.png") });
await browser.close();
if (process.env.ART_ONLY) process.exit(0);
function run(args: string[]) {
  const r = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw Error("Encoding failed.");
}
function stamp(s: number) {
  const ms = Math.round(s * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
const manifest: any = {
  source: { file: source.raw, sha256: source.sha256, browser: source.browser },
  benchmark: "docs/workflow-evaluation-v1.json",
  baseline: mini.model,
  pricingDate: benchmark.pricingDate,
  calculation: { time, cost },
  format: "1080×1350, H.264, 30 fps, AAC",
  interpretation:
    "Edited hosted footage and editorial cards sourced from the retained five-run-per-model local benchmark. Pauses are shortened and selected frames held. Footage playback is not the timing measurement.",
  films: [],
};
for (const [name, seq] of [
  [
    "roi-walkthrough",
    Object.entries(scenes)
      .filter(([id]) => id !== "socialroi")
      .map(([id, s]: any) => [id, s.dur]),
  ],
  [
    "roi-social",
    [
      ["hook", 3],
      ["table", 3],
      ["safeguard", 3],
      ["outcomes", 4],
      ["socialroi", 7],
      ["code", 5],
    ],
  ],
] as [string, [string, number][]][]) {
  let cursor = 0;
  const clips: string[] = [],
    subs: string[] = [],
    segments: any[] = [];
  for (const [id, dur] of seq) {
    const s = scenes[id],
      file = join(out, "clips", `${name}-${id}.mp4`),
      args = [
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        join(
          out,
          "art",
          `${name === "roi-social" && id === "code" ? "code-social" : id}.png`,
        ),
      ];
    let filter = "[0:v]null[base]",
      current = "base";
    if (s.comparisonStrips) {
      const shot = source.shots.find((x: any) => x.id === "compare-proof");
      args.push("-ss", String(shot.settled), "-t", "3.5", "-i", source.raw);
      filter += `;[1:v]setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=${dur},split=3[a][b][c];[a]crop=390:75:160:129,scale=660:126:flags=lanczos[ca];[b]crop=390:75:600:129,scale=660:126:flags=lanczos[cb];[c]crop=390:75:1040:129,scale=660:126:flags=lanczos[cc];[base][ca]overlay=210:516:shortest=1[first];[first][cb]overlay=210:650:shortest=1[second];[second][cc]overlay=210:784:shortest=1[strips]`;
      current = "strips";
    }
    if (s.shot) {
      const shot = source.shots.find((x: any) => x.id === s.shot);
      if (!shot) throw Error("Missing footage " + s.shot);
      const [x, y, w, h] = s.crop;
      const scale = Math.min(900 / w, 380 / h),
        dw = Math.round((w * scale) / 2) * 2,
        dh = Math.round((h * scale) / 2) * 2;
      const start = shot.settled - 0.3,
        length = Math.min(dur, shot.end - start - 0.1);
      args.push("-ss", String(start), "-t", String(length), "-i", source.raw);
      filter += `;[1:v]setpts=PTS-STARTPTS,crop=${w}:${h}:${x}:${y},scale=${dw}:${dh}:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${dur}[footage];[base][footage]overlay=${90 + Math.round((900 - dw) / 2)}:${530 + Math.round((380 - dh) / 2)}:shortest=1[framed]`;
      current = "framed";
      if (id === "human") {
        const exportShot = source.shots.find((x: any) => x.id === "export");
        args.push(
          "-ss",
          String(exportShot.settled),
          "-t",
          "3",
          "-i",
          source.raw,
        );
        filter += `;[2:v]setpts=PTS-STARTPTS,crop=307:45:42:846,scale=860:126:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=${dur},setpts=PTS+4/TB[download];[framed]drawbox=x=80:y=525:w=920:h=390:color=white:t=fill:enable='gte(t,4)'[cleared];[cleared][download]overlay=110:650:enable='gte(t,4)'[exported]`;
        current = "exported";
      }
    }
    filter += `;[${current}]${cursor ? "fade=t=in:st=0:d=0.10:color=0xf6f8ff," : ""}format=yuv420p[final]`;
    args.push(
      "-filter_complex",
      filter,
      "-map",
      "[final]",
      "-an",
      "-t",
      String(dur),
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      file,
    );
    run(args);
    clips.push(`file '${file}'`);
    if (name === "roi-walkthrough") {
      const a = narration.scenes.find((x: any) => x.id === id),
        d = JSON.parse(
          spawnSync(
            probe,
            ["-v", "quiet", "-show_format", "-of", "json", a.file],
            { encoding: "utf8" },
          ).stdout,
        ).format.duration;
      const tempo = Math.max(1, Number(d) / (dur - 0.25));
      run([
        "-i",
        a.file,
        "-af",
        `atempo=${tempo},adelay=100|100,apad,atrim=duration=${dur}`,
        "-ar",
        "48000",
        "-ac",
        "2",
        join(out, "clips", `${id}-voice.wav`),
      ]);
    }
    subs.push(
      `${segments.length + 1}\n${stamp(cursor)} --> ${stamp(cursor + dur)}\n${name === "roi-walkthrough" ? narration.scenes.find((x: any) => x.id === id).text : s.caption}\n`,
    );
    segments.push({
      id,
      start: cursor,
      end: cursor + dur,
      sourceShot: s.shot || null,
      crop: s.crop || null,
    });
    cursor += dur;
  }
  const concat = join(out, `${name}-concat.txt`);
  await writeFile(concat, clips.join("\n"));
  const silent = join(out, `${name}-silent.mp4`);
  run(["-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", silent]);
  let audio = join(out, "audio/superdoc-instrumental.wav");
  if (name === "roi-walkthrough") {
    const list = join(out, "voice-concat.txt");
    await writeFile(
      list,
      seq
        .map(([id]) => `file '${join(out, "clips", `${id}-voice.wav`)}'`)
        .join("\n"),
    );
    audio = join(out, "audio/narration-timed.wav");
    run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", audio]);
  }
  const video = join(out, `superdoc-jev-${name}.mp4`);
  run([
    "-i",
    silent,
    "-i",
    audio,
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-af",
    `loudnorm=I=${name === "roi-walkthrough" ? -16 : -23}:TP=-1.5:LRA=7`,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    String(cursor),
    "-movflags",
    "+faststart",
    video,
  ]);
  await writeFile(join(out, `superdoc-jev-${name}.srt`), subs.join("\n"));
  // A real first-frame cover keeps the deliverable central in a feed.
  run(["-i", video, "-frames:v", "1", join(out, `${name}-cover.png`)]);
  manifest.films.push({
    name,
    file: video,
    duration: cursor,
    segments,
    sha256: createHash("sha256")
      .update(await readFile(video))
      .digest("hex"),
    audio:
      name === "roi-walkthrough"
        ? "OpenAI Cedar standard voice; AI credit visible"
        : "Original synthesized instrumental; CC0-1.0",
  });
  console.log(`Rendered ${name}: ${cursor}s`);
}
if (
  createHash("sha256")
    .update(await readFile(source.raw))
    .digest("hex") !== source.sha256
)
  throw Error("Source changed during render.");
await writeFile(
  join(out, "film-manifest.json"),
  JSON.stringify(manifest, null, 2),
);
