import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const dir = "outputs/deal-desk";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1120 } });
const calls: unknown[] = [];
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (r) => {
  if (r.url().includes("/api/deal-desk") || r.url().endsWith("/api/reason")) {
    const data = await r.json();
    calls.push({ status: r.status(), data });
    await writeFile(
      `${dir}/live.json`,
      JSON.stringify({ calls, errors }, null, 2),
    );
  }
});
await page.goto(process.env.DEMO_BASE_URL ?? "http://localhost:5173/");
await expect(
  page.getByRole("button", { name: "Download Word", exact: true }),
).toBeEnabled({ timeout: 60000 });
await page.getByRole("checkbox").check();
await page
  .getByRole("button", { name: "Review the agreement", exact: true })
  .click();
await page
  .getByRole("button", { name: "Recheck changed clauses", exact: true })
  .waitFor({ state: "visible", timeout: 60000 });
await page.screenshot({ path: `${dir}/initial.png` });
await page.getByRole("button", { name: "Review matrix", exact: true }).click();
await page.screenshot({ path: `${dir}/matrix.png` });
const approve = page.getByRole("button", {
  name: "Approve language & propose 4 redlines",
  exact: true,
});
if (await approve.count()) {
  await approve.click();
  await page
    .getByText("Tracked edit verified", { exact: true })
    .waitFor({ timeout: 60000 });
  await expect(
    page.getByRole("button", { name: "Recheck changed clauses", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
}
await page.screenshot({ path: `${dir}/redline.png` });
await page.getByRole("button", { name: /Numbered safeguard/ }).click();
await page
  .getByRole("button", { name: "Approve numbered insertion", exact: true })
  .click();
await page
  .getByText("Tracked edit verified", { exact: true })
  .waitFor({ timeout: 30000 });
await page.screenshot({ path: `${dir}/numbered.png` });
await page.getByRole("button", { name: /Telemetry exception/ }).click();
if (process.env.RUN_REASON === "1") {
  await page
    .getByRole("button", { name: "Recheck changed clauses", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recheck changed clauses", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Ask reasoning model for a draft" })
    .click();
  await page
    .getByText("gpt-5.4 · Draft for review", { exact: true })
    .waitFor({ timeout: 80000 });
}
await page.screenshot({ path: `${dir}/human.png` });
const dl = page.waitForEvent("download");
await page.getByRole("button", { name: "Download Word", exact: true }).click();
await (await dl).saveAs(`${dir}/reviewed.docx`);
await page.getByRole("button", { name: "Execution", exact: true }).click();
await page.screenshot({ path: `${dir}/execution.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${dir}/mobile.png`, fullPage: true });
await writeFile(`${dir}/live.json`, JSON.stringify({ calls, errors }, null, 2));
console.log(JSON.stringify({ calls: calls.length, errors, artifacts: dir }));
await browser.close();
