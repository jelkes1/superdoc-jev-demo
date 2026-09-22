/** Editorial composition of genuine recorded footage. No generated app states or provider results. */
import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, join, basename } from "node:path";

const root = process.cwd(),
  out = resolve("outputs/social-film");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const original = JSON.parse(
  await readFile("outputs/video-v4-final/timeline.json", "utf8"),
);
const details = JSON.parse(
  await readFile(join(out, "detail-source.json"), "utf8"),
);
const measured = JSON.parse(
  await readFile("docs/recorded-run-v4.json", "utf8"),
);
if (
  original.errors.length ||
  details.errors.length ||
  original.shots.length !== 12 ||
  details.modelCalls !== 0
)
  throw new Error("Source recordings did not complete cleanly.");
const execution = measured.runs.find((r) => r.type === "execution").proof;
const decision = measured.runs
  .find((r) => r.type === "complete")
  .decisions.find((d) => d.id === "training");
if (
  execution.verified !== 5 ||
  execution.failed !== 0 ||
  !execution.proof.every((p) => p.exactTarget && p.tracked && p.preserved)
)
  throw new Error("The source does not support the displayed document proof.");
const sources = [original.raw, details.raw];
const sourceHashes = await Promise.all(
  sources.map(async (path) => ({
    path,
    sha256: createHash("sha256")
      .update(await readFile(path))
      .digest("hex"),
  })),
);
await mkdir(join(out, "art"), { recursive: true });
await mkdir(join(out, "clips"), { recursive: true });
const font = (
  await readFile(
    "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  )
).toString("base64");
const mono = (
  await readFile(
    "node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2",
  )
).toString("base64");
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const check = `<span class="tick">✓</span>`;
const stages = ["Decide", "Approve", "Execute", "Verify"];
const raw = original.raw;
const scenes = {
  hook: {
    seconds: 3,
    eyebrow: "DOCUMENT AGENTS, MEET WORD",
    title: "Jev decisions.<br><em>Real Word redlines.</em>",
    subtitle: "Inside your app. Ready for human review.",
    step: 2,
    video: { source: raw, start: 15.5, length: 3, crop: [346, 735, 812, 265] },
    window: "software-agreement.docx",
    bottom: `<div class="code-pill"><span>changeMode:</span> <b>"tracked"</b></div><p class="support">SuperDoc × Jev · a working developer example</p>`,
  },
  decision: {
    seconds: 5,
    eyebrow: "01 / DECISION LAYER",
    title: "Jev checks.<br><em>You approve.</em>",
    subtitle: "A clause judgment becomes proposed language.",
    step: 1,
    html: `<div class="response-card"><div class="file-label"><i></i> Actual response · ${esc(decision.model)}</div><div class="code-row"><span>rule</span><strong>training</strong></div><div class="code-row"><span>verdict</span><strong class="orange">${esc(decision.verdict)}</strong></div><div class="code-row"><span>confidence</span><strong>${Math.round(decision.confidence * 100)}% <small>native Jev value</small></strong></div><div class="approval"><span>HUMAN APPROVAL</span><p>Review the complete replacement.<br>Approve it before creating redlines.</p></div></div>`,
    bottom: `<p class="big-note">Models return decisions.<br>Application code controls the edit.</p>`,
  },
  execute: {
    seconds: 7,
    eyebrow: "02 / DOCUMENT EXECUTION",
    title: "Target the clause.<br><em>Create the redline.</em>",
    subtitle: "Tracked changes in a real DOCX.",
    step: 2,
    video: {
      source: raw,
      start: 13.7,
      length: 4.7,
      crop: [346, 710, 812, 310],
    },
    window: "§ 7.1 · training permission",
    bottom: `<div class="checks">${check} Exact target ${check} Tracked mode ${check} Text readback</div><p class="support">Fresh revision guards run before the operation.</p>`,
  },
  table: {
    seconds: 6,
    eyebrow: "03 / STRUCTURE STAYS INTACT",
    title: "Inside tables,<br><em>too.</em>",
    subtitle: "Update the order form in place.",
    step: 2,
    video: {
      source: raw,
      start: 23.0,
      length: 3.15,
      crop: [350, 615, 754, 370],
    },
    window: "Order form · table cell",
    bottom: `<p class="big-note">The table stays editable.<br>The change stays reviewable.</p>`,
  },
  list: {
    seconds: 6,
    eyebrow: "04 / EXPLICIT APPROVAL",
    title: "Add a safeguard.<br><em>Keep the numbering.</em>",
    subtitle: "Missing terms require a separate human decision.",
    step: 2,
    video: {
      source: raw,
      start: 28.3,
      length: 3.75,
      crop: [350, 697, 820, 333],
    },
    window: "Schedule C · tracked numbered insertion",
    bottom: `<div class="checks">${check} Real list item ${check} Accept / reject</div><p class="support">Inserted through SuperDoc’s document API.</p>`,
  },
  preserve: {
    seconds: 6,
    eyebrow: "05 / EXISTING WORK SURVIVES",
    title: "Keep counsel’s<br><em>negotiated revision.</em>",
    subtitle: "The exported DOCX still contains this change.",
    step: 3,
    video: {
      source: details.raw,
      start: details.shots.find((s) => s.id === "payment").start + 0.3,
      length: 4,
      crop: [342, 670, 790, 205],
    },
    window: "§ 4.2 · pre-existing counsel redline",
    bottom: `<div class="author"><span class="avatar">AC</span><div><b>Alex Chen · Meridian counsel</b><span>Existing 45 → 30 day payment revision retained</span></div></div><p class="support">Reopened export: 2 counsel revisions + 3 pending agent edits.</p>`,
  },
  human: {
    seconds: 6,
    eyebrow: "06 / HUMAN REVIEW",
    title: "Accept. Reject.<br><em>Keep judgment human.</em>",
    subtitle: "Ambiguous terms can stay unresolved.",
    step: 1,
    video: {
      source: raw,
      start: 32.4,
      length: 4.9,
      crop: [1234, 465, 348, 315],
    },
    window: "Review controls · actual application",
    bottom: `<p class="big-note">Request a draft when needed.<br>Or leave it for human review.</p>`,
  },
  code: {
    seconds: 8,
    eyebrow: "07 / THE INTEGRATION",
    title: "Models decide.<br><em>Code edits the document.</em>",
    subtitle: "The tracked replacement call in this example:",
    step: 2,
    html: `<div class="editor"><div class="file-label"><i></i> lib/deal-desk/document.ts</div><pre><span class="purple">const</span> receipt = <span class="purple">await</span> doc.<span class="green">replace</span>(
  {
    target: match.items[0].target,
    text: row.replacement,
  },
  {
    <span class="green">changeMode: "tracked",</span>
    expectedRevision: reading.revision,
  }
);</pre></div>`,
    bottom: `<div class="checks">${check} Capability check ${check} Readback ${check} Revision evidence</div><p class="support">Full guards and verification are in the linked source.</p>`,
  },
  proof: {
    seconds: 8,
    eyebrow: "08 / MEASURE THE OUTCOME",
    title: "A Word edit.<br><em>With evidence.</em>",
    subtitle: "One genuine run, measured at export.",
    step: 3,
    html: `<div class="metrics"><div><strong>${execution.verified}<i>✓</i></strong><span>verified Word changes</span></div><div><strong>${(execution.activeMs / 1000).toFixed(2)}<small>s</small></strong><span>active processing</span></div><div><strong class="cost">$${execution.usage.reduce((s, r) => s + r.usage.costUsd, 0).toFixed(6)}</strong><span>estimated review model cost</span></div></div>`,
    bottom: `<p class="support left">Human pauses and model comparison excluded.<br>Document execution evidence; not legal accuracy.</p>`,
  },
  cta: {
    seconds: 5,
    eyebrow: "BUILD DOCUMENT AGENTS",
    title: "Try the demo.<br><em>Read the code.</em>",
    subtitle: "Jev + SuperDoc. A runnable TypeScript example.",
    step: 3,
    html: `<div class="cta-card"><div class="flow"><div>Jev<span>Decisions</span></div><b>→</b><div>SuperDoc<span>Document operations</span></div><b>→</b><div>Human<span>Review</span></div></div><div class="terminal"><span>$</span> npm ci<br><span>$</span> npm run dev</div><p class="setup">Setup and provider keys: README</p></div>`,
    bottom: `<div class="cta-button">Explore the working example <b>↗</b></div><p class="repo">github.com/jelkes1/superdoc-jev-demo</p>`,
  },
};

function template(id, s) {
  const editorial = ["decision", "code", "proof", "cta"].includes(id);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font})} @font-face{font-family:Mono;src:url(data:font/woff2;base64,${mono})}
*{box-sizing:border-box}body{margin:0;width:1080px;height:1350px;overflow:hidden;background:#0b172b;color:#f8fbff;font-family:Geist,Arial} .texture{position:absolute;inset:0;background:radial-gradient(ellipse at 98% 5%,#17365988,transparent 56%)}
.brand{position:absolute;left:56px;right:56px;top:46px;display:flex;align-items:center;justify-content:space-between;font-size:27px;font-weight:650;letter-spacing:-.8px}.brand svg{vertical-align:-6px;margin-right:12px}.brand .times{color:#6d879d;margin:0 10px;font-weight:400}.brand small{font:17px Mono;color:#afc4d7;letter-spacing:1px;border:1px solid #34465c;border-radius:30px;padding:9px 15px}
.eyebrow{position:absolute;top:139px;left:56px;color:#a6bdd0;font:19px Mono;letter-spacing:1.8px}h1{position:absolute;left:52px;top:175px;right:42px;margin:0;font-size:73px;line-height:1.065;font-weight:650;letter-spacing:-3.5px}h1 em{font-style:normal;color:#8be4c5} .subtitle{position:absolute;left:56px;right:56px;top:356px;margin:0;color:#b9cbdc;font-size:27px;line-height:1.35;letter-spacing:-.4px}
.content{position:absolute;left:56px;top:428px;width:968px;height:580px}.window{background:white;border:1px solid #d0dfeb;border-radius:18px;overflow:hidden;box-shadow:0 24px 70px #0003}.window-bar{height:56px;color:#50667c;background:#edf3f8;border-bottom:1px solid #dae3ec;padding:15px 22px;font:20px Mono}.dots{font-size:17px;letter-spacing:5px;color:#8197aa;margin-right:20px}.window .white{height:520px;background:white}
.bottom{position:absolute;left:56px;right:56px;top:1049px;height:188px}.code-pill{border:1px solid #36566a;background:#10263a;border-radius:12px;padding:20px;text-align:center;font:31px Mono;letter-spacing:-1px}.code-pill span{color:#a8c3d6}.code-pill b{color:#8be4c5;font-weight:500}.support{color:#9fb6ca;font-size:23px;line-height:1.45;letter-spacing:-.4px;text-align:center;margin:22px 0 0}.left{text-align:left;font-size:25px;line-height:1.7}.big-note{font-size:34px;line-height:1.32;color:#dce8f1;font-weight:450;margin:7px 0;letter-spacing:-.7px}.checks{display:flex;align-items:center;gap:12px;font-size:24px;white-space:nowrap;letter-spacing:-.7px}.tick{color:#8be4c5;font-size:26px;margin-left:9px}.tick:first-child{margin-left:0}.author{display:flex;gap:18px;align-items:center}.avatar{border:1px solid #45627b;border-radius:50%;height:66px;width:66px;display:grid;place-content:center;color:#b4c8d9;font-size:23px}.author b{display:block;font-size:28px}.author div>span{display:block;color:#adc4d6;font-size:24px;margin-top:6px}
.footer{position:absolute;left:56px;right:56px;bottom:30px;display:flex;align-items:center;justify-content:space-between;font:16px Mono;color:#859fb4}.stages{display:flex;gap:16px}.stages b{color:#8be4c5;font-weight:400}.rule{position:absolute;left:56px;right:56px;bottom:76px;border-top:1px solid #263b50}.rule:before{content:"";display:block;height:3px;width:${Math.round(((Object.keys(scenes).indexOf(id) + 1) / 10) * 100)}%;background:#8be4c5;position:absolute;top:-2px}
.response-card,.editor,.cta-card{height:100%;border:1px solid #365168;border-radius:18px;background:#102236;overflow:hidden;box-shadow:0 24px 70px #0002}.file-label{padding:21px 25px;border-bottom:1px solid #2a4358;font:19px Mono;color:#aac1d5;display:flex;align-items:center;gap:12px}.file-label i{width:9px;height:9px;display:inline-block;background:#8be4c5;border-radius:50%}.code-row{display:flex;align-items:center;padding:24px 29px;border-bottom:1px solid #263e52;gap:36px;font:27px Mono}.code-row>span{color:#8da7bc;width:215px}.code-row>strong{font-weight:500;color:#e8f3fa}.code-row .orange{color:#ffc19a}.code-row small{color:#8da7bc;font:19px Geist}.approval{margin:25px 28px;background:#17324a;border-left:3px solid #8be4c5;padding:20px 24px}.approval>span{color:#8be4c5;font:18px Mono;letter-spacing:1px}.approval p{font-size:28px;line-height:1.45;margin:12px 0 0;color:#dce9f4}.editor pre{font:26px/1.62 Mono;letter-spacing:-.7px;padding:17px 28px;margin:0;color:#dceaf5}.purple{color:#c4afff}.green{color:#8be4c5}.metrics{height:100%;display:grid;grid-template-rows:repeat(3,1fr);border-top:1px solid #365168}.metrics>div{display:flex;align-items:baseline;gap:35px;border-bottom:1px solid #365168;padding:15px 5px}.metrics strong{font-size:100px;line-height:1.25;letter-spacing:-6px;font-weight:600;min-width:410px}.metrics strong>i{font:46px Geist;color:#8be4c5;vertical-align:23px;margin-left:27px}.metrics span{font-size:28px;color:#b6cbdc;letter-spacing:-.6px}.metrics .cost{font-size:76px;letter-spacing:-4px}.metrics small{font-size:53px;margin-left:6px}.flow{display:flex;align-items:center;justify-content:space-between;padding:54px 29px 43px;text-align:center}.flow div{font-size:34px;font-weight:600;letter-spacing:-1px}.flow span{display:block;font-size:18px;font-weight:400;color:#9eb9ce;margin-top:11px;letter-spacing:0}.flow>b{font-size:27px;color:#688b9f}.terminal{margin:6px 32px;border:1px solid #375169;border-radius:13px;background:#081527;padding:25px;font:31px/1.85 Mono;color:#e4eff7}.terminal span{color:#8be4c5;margin-right:16px}.setup{font-size:22px;color:#a2bcd0;margin:26px 34px}.cta-button{background:#8be4c5;border-radius:12px;padding:24px 25px;color:#0b172b;font-size:34px;font-weight:600;letter-spacing:-.9px;display:flex;justify-content:space-between}.repo{font:23px Mono;color:#b9cfe0;text-align:center;margin-top:22px}
</style></head><body><div class="texture"></div><div class="brand"><div><svg width="28" height="32" viewBox="0 0 28 32" fill="none"><path d="M6 2h11l7 7v21H4V2h2Z" stroke="#dce9f5" stroke-width="2"/><path d="M16 2v8h8M8 15h12M8 20h12M8 25h8" stroke="#8be4c5" stroke-width="2"/></svg>SuperDoc<span class="times">×</span>Jev</div><small>DEVELOPER DEMO</small></div><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1><p class="subtitle">${s.subtitle}</p><div class="content ${s.video ? "window" : ""}">${s.video ? `<div class="window-bar"><span class="dots">●●●</span>${s.window}</div><div class="white"></div>` : s.html}</div><div class="bottom">${s.bottom}</div><div class="rule"></div><div class="footer"><div class="stages">${stages.map((x, i) => (i === s.step ? `<b>${x}</b>` : x)).join("<span>→</span>")}</div><span>${editorial ? "CODE + RECORDED RUN EVIDENCE" : "REAL DOCX · EDITED HIGHLIGHTS"}</span></div></body></html>`;
}
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
});
try {
  for (const [id, s] of Object.entries(scenes)) {
    await page.setContent(template(id, s));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(out, "art", `${id}.png`) });
  }
} finally {
  await browser.close();
}

function run(args) {
  const r = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { stdio: "inherit" },
  );
  if (r.status !== 0) throw new Error("Video encoding failed.");
}
function stamp(s) {
  const ms = Math.round(s * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}
const captions = {
  hook: "Jev decisions. Real Word redlines. Inside your app.",
  decision: "Jev checks the clause. A human approves the proposed language.",
  execute:
    "SuperDoc targets the clause, creates a tracked change, and verifies the result.",
  table: "The order-form cell changes in place. The table stays editable.",
  list: "A separately approved safeguard becomes a real numbered, tracked list item.",
  preserve:
    "Counsel’s existing payment revision survives in the exported DOCX.",
  human: "Accept or reject changes. Ambiguous terms can stay for human review.",
  code: "Models return decisions. Application code executes tracked document operations with revision guards.",
  proof: `One recorded run: ${execution.verified} verified Word changes, ${(execution.activeMs / 1000).toFixed(2)} seconds active processing, $0.000157 estimated review model cost. Human pauses and comparison excluded.`,
  cta: "Try the live demo and reuse the TypeScript example. Links in the post.",
};
const timeline = [];
for (const [name, sequence] of [
  ["developer-story", Object.entries(scenes).map(([id, s]) => [id, s.seconds])],
  [
    "developer-social",
    [
      ["hook", 2],
      ["execute", 6],
      ["table", 4],
      ["preserve", 4],
      ["proof", 5],
      ["cta", 4],
    ],
  ],
]) {
  let cursor = 0;
  const files = [],
    subs = [],
    segments = [];
  for (const [index, [id, duration]] of sequence.entries()) {
    const scene = scenes[id],
      file = join(out, "clips", `${name}-${id}.mp4`),
      base = join(out, "art", `${id}.png`);
    const args = ["-loop", "1", "-framerate", "30", "-i", base];
    let filter;
    if (scene.video) {
      const v = scene.video,
        [x, y, w, h] = v.crop,
        scale = Math.min(952 / w, 504 / h),
        dw = Math.round((w * scale) / 2) * 2,
        dh = Math.round((h * scale) / 2) * 2;
      args.push(
        "-ss",
        String(v.start),
        "-t",
        String(Math.min(v.length, duration)),
        "-i",
        v.source,
      );
      filter = `[1:v]setpts=PTS-STARTPTS,crop=${w}:${h}:${x}:${y},scale=${dw}:${dh}:flags=lanczos,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=${duration},zoompan=z='1+0.02*min(on/${duration * 30},1)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=${dw}x${dh}:fps=30[footage];[0:v][footage]overlay=x=${64 + Math.round((952 - dw) / 2)}:y=${492 + Math.round((504 - dh) / 2)}:shortest=1[v]`;
    } else filter = "[0:v]null[v]";
    // Brief entry fade keeps cuts deliberate without obscuring review footage.
    filter += `;[v]${index ? "fade=t=in:st=0:d=0.13:color=0x0b172b," : ""}format=yuv420p[final]`;
    args.push(
      "-filter_complex",
      filter,
      "-map",
      "[final]",
      "-an",
      "-t",
      String(duration),
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
    files.push(`file '${file.replaceAll("'", "'\\''")}'`);
    subs.push(
      `${index + 1}\n${stamp(cursor)} --> ${stamp(cursor + duration)}\n${captions[id]}\n`,
    );
    segments.push({
      id,
      start: cursor,
      end: cursor + duration,
      source: scene.video ?? null,
      caption: captions[id],
    });
    cursor += duration;
  }
  const concat = join(out, `${name}-concat.txt`);
  await writeFile(concat, files.join("\n"));
  const video = join(out, `superdoc-jev-${name}.mp4`);
  run([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concat,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    video,
  ]);
  await writeFile(join(out, `superdoc-jev-${name}.srt`), subs.join("\n"));
  timeline.push({
    name,
    video,
    seconds: cursor,
    segments,
    sha256: createHash("sha256")
      .update(await readFile(video))
      .digest("hex"),
  });
}
for (const source of sourceHashes)
  if (
    createHash("sha256")
      .update(await readFile(source.path))
      .digest("hex") !== source.sha256
  )
    throw new Error("Source changed during rendering.");
await writeFile(
  join(out, "film-manifest.json"),
  JSON.stringify(
    {
      format: "1080x1350 H.264, 30fps, silent, on-screen narrative + SRT",
      sourceCommit: "ecb157ffcd57e705f011e1fbc65996ef3625b6d1",
      originalBrowser: original.browser,
      supplementalBrowser: details.browser,
      sourceHashes,
      measurement: execution,
      interpretation:
        "Edited highlights of one genuine production run, plus the reopened export. Footage is cropped and may hold its last frame; playback is not a wall-clock benchmark. Editorial response/code/metric cards are derived from the actual run and repository, not simulated app screens.",
      timeline,
    },
    null,
    2,
  ),
);
console.log(
  "60-second developer story and 25-second feed cut rendered; inspect before sharing.",
);
