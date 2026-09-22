/** Standard OpenAI voice, using the existing server key. No voice cloning. */
import { mkdir, writeFile, readFile } from "node:fs/promises";
const out = "outputs/roi-film/audio";
await mkdir(out, { recursive: true });
const scenes = [
  [
    "hook",
    4,
    "Your document agent should deliver a Word file people can review.",
  ],
  [
    "execute",
    6,
    "Jev makes the decisions. SuperDoc creates and verifies real tracked changes.",
  ],
  ["table", 4, "Even inside tables. The structure stays editable."],
  [
    "safeguard",
    5,
    "Add an approved safeguard, with real numbering and a comment.",
  ],
  [
    "compare",
    7,
    "Then swap the decision model. Same contract, approved language, and SuperDoc execution. Independent copies.",
  ],
  [
    "outcomes",
    5,
    "Five runs per model. All fifteen produced the same five verified edits.",
  ],
  [
    "time",
    7,
    "On this fictional sample, Jev cut median processing by one point one eight seconds versus GPT five point four mini.",
  ],
  [
    "cost",
    7,
    "Estimated model spend was eighty-two point four percent lower. At ten thousand equivalent runs, that projects to seven dollars thirty-two saved.",
  ],
  [
    "human",
    7,
    "Inspect the receipts. Keep counsel’s revisions. Accept or reject each change, then download the Word file.",
  ],
  [
    "code",
    8,
    "The model decides. SuperDoc handles document execution. Try the live demo, inspect the benchmark, and fork the TypeScript example.",
  ],
];
const meta = [];
for (const [id, seconds, text] of scenes) {
  const file = `${out}/${id}.mp3`;
  try {
    await readFile(file);
    meta.push({ id, seconds, text, file, reused: true });
    continue;
  } catch {}
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts-2025-12-15",
      voice: "cedar",
      input: text,
      instructions:
        "Calm, clear, neutral technical product narrator. Conversational and measured, without advertising hype. Brisk enough for a developer demo. Jev rhymes with dev. Pronounce SuperDoc as super dock. No introduction. No added words.",
      response_format: "mp3",
    }),
  });
  if (!r.ok) throw Error(`Speech ${id} failed HTTP ${r.status()}`);
  await writeFile(file, new Uint8Array(await r.arrayBuffer()));
  meta.push({
    id,
    seconds,
    text,
    file,
    reused: false,
    requestId: r.headers.get("x-request-id"),
  });
  console.log(`Generated ${id}`);
}
await writeFile(
  `${out}/narration.json`,
  JSON.stringify(
    {
      provider: "OpenAI",
      model: "gpt-4o-mini-tts-2025-12-15",
      voice: "cedar",
      credit: "AI-generated narration",
      scenes: meta,
    },
    null,
    2,
  ),
);
