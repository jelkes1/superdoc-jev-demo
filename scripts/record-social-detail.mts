/** Supplemental footage from the exact, previously verified fictional export. No model call. */
import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const out = resolve("outputs/social-film");
const file = resolve("outputs/video-v4-final/reviewed-agreement.docx");
await mkdir(out, { recursive: true });
const hash = createHash("sha256")
  .update(await readFile(file))
  .digest("hex");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  recordVideo: { dir: out, size: { width: 1600, height: 1080 } },
});
const page = await context.newPage();
const errors: string[] = [],
  requests: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/\/api\/(review|deal-desk|reason|compare)$/.test(r.url()))
    requests.push(r.url());
});
const zero = performance.now();
const shots: { id: string; start: number; end: number }[] = [];
try {
  await page.goto("http://localhost:5173/");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page.locator(".canvas-status")).toContainText("5 revisions");
  await page
    .getByRole("button", { name: "Explore freely", exact: true })
    .click();
  for (const [id, label] of [
    ["payment", "Agreed payment terms"],
    ["liability", "Competing liability position"],
  ]) {
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(1500);
    const start = (performance.now() - zero) / 1000;
    await page.screenshot({ path: `${out}/${id}.png`, fullPage: false });
    await page.waitForTimeout(4500);
    shots.push({ id, start, end: (performance.now() - zero) / 1000 });
  }
  const evidence = await page.evaluate(async () => {
    const doc = window.__dealDesk!.instance.activeEditor!.doc!;
    return {
      info: await doc.info({}),
      changes: (await doc.trackChanges.list({ limit: 1000 })).items.map(
        (c) => ({
          id: c.id,
          author: c.author,
          inserted: c.insertedText,
          deleted: c.deletedText,
        }),
      ),
    };
  });
  expect(evidence.info.counts.tables).toBe(3);
  expect(evidence.info.counts.comments).toBe(6);
  expect(
    evidence.changes.filter((c) => c.author === "Alex Chen · Meridian counsel"),
  ).toHaveLength(2);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  const video = page.video()!;
  await context.close();
  await writeFile(
    `${out}/detail-source.json`,
    JSON.stringify(
      {
        file,
        sha256: hash,
        browser: browser.version(),
        raw: await video.path(),
        shots,
        evidence,
        errors,
        modelCalls: requests.length,
      },
      null,
      2,
    ),
  );
  console.log(
    "Supplemental export footage verified: two counsel revisions, three tables, six comments, zero model calls.",
  );
} finally {
  await browser.close();
}
