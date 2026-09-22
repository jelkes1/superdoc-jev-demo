/** Genuine hosted run. No mocked responses; final proof and every output are retained. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const out = resolve("outputs/roi-film");
await mkdir(out, { recursive: true });
const origin =
  process.env.DEMO_BASE_URL ||
  "https://superdoc-jev.superdoc-1393.chatgpt.site";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  recordVideo: { dir: out, size: { width: 1600, height: 1080 } },
});
const page = await context.newPage();
const errors: string[] = [],
  responses: unknown[] = [],
  shots: unknown[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const zero = performance.now(),
  time = () => (performance.now() - zero) / 1000;
async function shot(id: string, action: () => Promise<unknown>, hold = 3500) {
  const start = time();
  await action();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${id}.png` });
  const settled = time();
  await page.waitForTimeout(hold);
  shots.push({ id, start, settled, end: time() });
}
async function finding(label: string) {
  await page
    .locator(".guided-queue")
    .getByRole("button", { name: new RegExp(label) })
    .click();
}
let passed = false;
try {
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await shot("home", async () => {});
  await shot("review", async () => {
    const p = page.waitForResponse((r) => r.url().endsWith("/api/deal-desk"));
    await page
      .getByRole("button", { name: "Review agreement", exact: true })
      .first()
      .click();
    const r = await p;
    const body = await r.json();
    responses.push({ endpoint: "deal-desk", body });
    if (!r.ok()) throw Error(JSON.stringify(body));
    await expect(
      page.getByRole("heading", { name: "Approve the proposed language." }),
    ).toBeVisible({ timeout: 60000 });
  });
  await shot(
    "redline",
    async () => {
      await page
        .getByRole("button", {
          name: "Approve selected language & create redlines",
        })
        .click();
      await expect(
        page.getByRole("heading", { name: /4 verified Word changes/ }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByText("Tracked edit verified", { exact: true }),
      ).toBeVisible();
    },
    5000,
  );
  await shot("table", () => finding("Order-form permission"), 4000);
  await shot(
    "safeguard",
    async () => {
      await finding("Numbered safeguard");
      await page.getByRole("button", { name: "Add as tracked change" }).click();
      await expect(
        page.getByRole("heading", { name: /5 verified Word changes/ }),
      ).toBeVisible();
      await expect(
        page.getByText("Numbered insertion tracked", { exact: true }),
      ).toBeVisible();
    },
    4500,
  );
  const beforeDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .first()
    .click();
  await (await beforeDownload).saveAs(`${out}/before-comparison.docx`);
  await shot(
    "compare-setup",
    async () => {
      await page
        .getByRole("button", { name: "Compare time & cost", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Approve language & compare",
          exact: true,
        }),
      ).toBeEnabled({ timeout: 60000 });
      await page.getByRole("checkbox", { name: /Also approve/ }).check();
    },
    3500,
  );
  await shot(
    "compare-run",
    async () => {
      await page
        .getByRole("button", {
          name: "Approve language & compare",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Comparison finished.", { exact: true }),
      ).toBeVisible({ timeout: 120000 });
      await expect(
        page
          .locator(".model-card h4")
          .filter({ hasText: "5 verified Word changes" }),
      ).toHaveCount(3);
      await expect(
        page.getByText("✓ Same approved changes verified", { exact: true }),
      ).toBeVisible();
      await page.locator(".workflow-baseline").scrollIntoViewIfNeeded();
    },
    6000,
  );
  const results = (
    await page.locator(".workflow-proof details pre").allTextContents()
  ).map((text) => JSON.parse(text));
  if (
    results.length !== 3 ||
    results.some(
      (r) => r.failed || !r.preserved || !r.expectedOutcome || !r.timingValid,
    )
  )
    throw Error("Incomplete hosted workflow proof");
  responses.push({ endpoint: "workflow", results });
  for (let i = 0; i < 3; i++) {
    const d = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download DOCX", exact: true })
      .nth(i)
      .click();
    await (await d).saveAs(`${out}/${results[i].model}-hosted.docx`);
  }
  await shot(
    "compare-proof",
    async () => {
      await page.locator(".workflow-proof > summary").click();
      await page.locator(".workflow-proof").scrollIntoViewIfNeeded();
    },
    4000,
  );
  await page
    .getByRole("button", { name: "Return to your document", exact: true })
    .click();
  const afterDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .first()
    .click();
  await (await afterDownload).saveAs(`${out}/after-comparison.docx`);
  for (const part of [
    "word/document.xml",
    "word/comments.xml",
    "word/numbering.xml",
  ])
    expect(
      execFileSync("unzip", [
        "-p",
        `${out}/after-comparison.docx`,
        part,
      ]).toString(),
    ).toEqual(
      execFileSync("unzip", [
        "-p",
        `${out}/before-comparison.docx`,
        part,
      ]).toString(),
    );
  await shot(
    "human",
    async () => {
      await finding("Training permission");
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(
        page.getByText("You accepted this proposal.", { exact: true }),
      ).toBeVisible();
      await finding("Cancellation window");
    },
    4500,
  );
  await shot(
    "reject",
    async () => {
      await page.getByRole("button", { name: "Reject", exact: true }).click();
      await expect(
        page.getByText("You rejected this proposal.", { exact: true }),
      ).toBeVisible();
    },
    2500,
  );
  await shot(
    "export",
    async () => {
      await page
        .getByRole("button", {
          name: "Continue to export with remaining items",
        })
        .click();
      const d = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download Word", exact: true })
        .first()
        .click();
      await (await d).saveAs(`${out}/reviewed-agreement.docx`);
    },
    4000,
  );
  expect(errors).toEqual([]);
  passed = true;
} finally {
  await page.screenshot({ path: `${out}/last-state.png` });
  const video = page.video()!;
  await context.close();
  const raw = await video.path();
  await writeFile(
    `${out}/hosted-source.json`,
    JSON.stringify(
      {
        origin,
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        viewport: { width: 1600, height: 1080 },
        raw,
        sha256: createHash("sha256")
          .update(await readFile(raw))
          .digest("hex"),
        passed,
        errors,
        shots,
        responses,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
console.log(
  "Hosted review, five verified edits, three equivalent workflow outputs, active-document preservation, accept/reject and export passed.",
);
