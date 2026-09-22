import { chromium, expect } from "@playwright/test";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
const file = resolve(process.argv[2] || "outputs/headless/reviewed.docx");
const expectedComments = Number(process.argv[3] || 6);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:5173/");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  await page.locator("input[type=file]").setInputFiles(file);
  await page.waitForFunction(async (count) => {
    try {
      return (
        (await window.__dealDesk!.instance.activeEditor!.doc!.info({})).counts
          .comments === count
      );
    } catch {
      return false;
    }
  }, expectedComments);
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  const result = await page.evaluate(async () => {
    const n = window.__dealDesk!,
      doc = n.instance.activeEditor!.doc!;
    const reading = await n.read(doc, { training: "consent", notice: 30 });
    return {
      info: await doc.info({}),
      changes: reading.changes.map((c) => ({
        author: c.author,
        inserted: c.insertedText,
        deleted: c.deletedText,
      })),
      safeguard: reading.rows.find((r) => r.id === "safeguard")?.present,
    };
  });
  expect(result.info.counts.tables).toBe(3);
  expect(result.info.counts.lists).toBeGreaterThan(0);
  expect(
    result.changes.some(
      (c) => c.author === "Alex Chen · Meridian counsel" && c.inserted === "30",
    ),
  ).toBe(true);
  expect(
    result.changes.filter((c) => c.author === "Northstar · Document agent")
      .length,
  ).toBeGreaterThanOrEqual(4);
  await writeFile(file + ".verification.json", JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({
      file,
      comments: result.info.counts.comments,
      tables: result.info.counts.tables,
      changes: result.changes.length,
      safeguard: result.safeguard,
    }),
  );
} finally {
  await browser.close();
}
