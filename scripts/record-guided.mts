/** Genuine live workflow; provider responses and document operations are never stubbed. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const origin = process.env.DEMO_BASE_URL || "http://localhost:5173";
const out = resolve(process.env.VIDEO_OUTPUT_DIR || "outputs/video-v4");
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  recordVideo: { dir: out, size: { width: 1600, height: 1080 } },
});
const page = await context.newPage(),
  errors: string[] = [],
  measured: unknown[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const shots: { start: number; end: number; caption: string; wait: boolean }[] =
  [];
const start = performance.now(),
  time = () => (performance.now() - start) / 1000;
async function shot(
  caption: string,
  action: () => Promise<unknown>,
  hold = 3500,
  wait = false,
) {
  const s = time();
  await action();
  await page.waitForTimeout(hold);
  shots.push({ start: s, end: time(), caption, wait });
}
async function review(button = "Review agreement") {
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/deal-desk"),
  );
  await page.getByRole("button", { name: button, exact: true }).first().click();
  const r = await response,
    data = await r.json();
  if (!r.ok()) throw new Error(data.error);
  measured.push({
    type: "complete",
    model: "jev-1.13.0",
    usage: data.usage,
    decisions: data.decisions,
  });
  await expect(
    page.getByRole("heading", { name: "Approve the proposed language." }),
  ).toBeVisible();
}
async function finding(name: string) {
  await page
    .locator(".guided-queue")
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
let succeeded = false;
try {
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await shot(
    "Four steps from a negotiated agreement to a reviewable Word counterproposal.",
    async () => {
      await page
        .getByRole("heading", { name: "Review the returned agreement." })
        .scrollIntoViewIfNeeded();
    },
    4000,
  );
  await shot(
    "Jev checks the live clauses. Review the complete proposed language before approving.",
    async () => {
      await page
        .getByRole("checkbox", {
          name: "Send extracted clause text to TypeSafe for this review.",
        })
        .check();
      await review();
    },
    3800,
  );
  const proposed = await page.locator(".guided-proposal").count();
  if (!proposed)
    throw new Error(
      "Live run produced no supported proposals. Do not simulate edits.",
    );
  await shot(
    "SuperDoc creates real tracked replacements and verifies their targets, text and revisions.",
    async () => {
      await page
        .getByRole("button", {
          name: "Approve selected language & create redlines",
        })
        .click();
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`${proposed} verified Word changes`),
        }),
      ).toBeVisible({ timeout: 60000 });
      await expect(
        page.getByText("Tracked edit verified", { exact: true }),
      ).toBeVisible();
    },
    4000,
  );
  await shot(
    "The result counts Word operations, processing seconds and estimated model cost. Human pauses are excluded.",
    async () => {
      await page
        .getByText("Timing, tokens & verification evidence", { exact: true })
        .click();
      await page.locator(".run-proof").scrollIntoViewIfNeeded();
    },
    4000,
  );
  await page
    .getByText("Timing, tokens & verification evidence", { exact: true })
    .click();
  await shot(
    "An order-form cell changes in place. The Word table stays editable.",
    () => finding("Order-form permission"),
    3600,
  );
  await shot(
    "Missing terms need separate approval. Insert a real numbered safeguard as a tracked change.",
    async () => {
      await finding("Numbered safeguard");
      await page
        .getByRole("button", { name: "Approve numbered insertion" })
        .click();
      await expect(
        page.getByRole("heading", {
          name: new RegExp(`${proposed + 1} verified Word changes`),
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Tracked edit verified", { exact: true }),
      ).toBeVisible();
    },
    3800,
  );
  await shot(
    "Accept one change. Reject another. Counsel’s pre-existing revisions remain intact.",
    async () => {
      await finding("Training permission");
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(
        page.getByText("You accepted this proposal.", { exact: true }),
      ).toBeVisible();
      await finding("Cancellation window");
      await page.getByRole("button", { name: "Reject", exact: true }).click();
      await expect(
        page.getByText("You rejected this proposal.", { exact: true }),
      ).toBeVisible();
    },
    3000,
  );
  await shot(
    "Ambiguous terms stay unresolved. A person can request a draft or leave them for human review.",
    async () => {
      await finding("Telemetry exception");
      await page
        .getByRole("button", { name: "Leave for human review" })
        .click();
      await finding("Telemetry exception");
    },
    3500,
  );
  await shot(
    "Export with an honest summary: accepted, rejected, pending and unresolved.",
    async () => {
      await page
        .getByRole("button", {
          name: "Continue to export with remaining items",
        })
        .click();
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download Word", exact: true })
        .click();
      await (await download).saveAs(`${out}/reviewed-agreement.docx`);
      const trace = page.locator(".run-proof").locator("pre").first();
      measured.push({
        type: "execution",
        proof: JSON.parse((await trace.textContent()) || "{}"),
      });
    },
    3500,
  );
  await shot(
    "Optional: compare three exact models on one frozen snapshot. Classification never changes the document.",
    async () => {
      await page
        .getByRole("button", { name: "Compare models", exact: true })
        .click();
      await page
        .getByRole("checkbox", {
          name: /I agree to send this extracted contract text/,
        })
        .check();
      const response = page.waitForResponse((r) =>
        r.url().endsWith("/api/compare"),
      );
      await page.getByRole("button", { name: "Run fresh comparison" }).click();
      const r = await response;
      if (!r.ok()) throw new Error(`Comparison HTTP ${r.status()}`);
      await expect(page.getByText(/All three responses received/)).toBeVisible({
        timeout: 70000,
      });
      const results = (
        await page.locator(".comparison-panel details pre").allTextContents()
      ).map((text) => JSON.parse(text));
      if (results.length !== 3)
        throw new Error("Missing actual comparison results");
      measured.push({
        type: "comparison",
        events: results.map((result) => ({ type: "result", result })),
        settings: await page.locator(".snapshot-meta").textContent(),
      });
      await page.locator(".comparison-table-scroll").scrollIntoViewIfNeeded();
    },
    4000,
    true,
  );
  await page
    .getByRole("button", { name: "Compare models", exact: true })
    .click();
  await shot(
    "Change the agreed notice period. Accepted work stays; only owned pending suggestions are replaced.",
    async () => {
      await page.locator(".supporting-settings > summary").click();
      await page
        .getByRole("combobox", { name: "Renewal notice", exact: true })
        .selectOption("60");
      await expect(
        page
          .getByRole("button", { name: "Recheck changed clauses", exact: true })
          .first(),
      ).toBeEnabled();
      await review("Recheck changed clauses");
    },
    3200,
    true,
  );
  await shot(
    "Inspect the exact target and execution receipt. Reuse the same document operations in your app.",
    async () => {
      await page
        .getByRole("button", { name: "Inspect proof", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Models decide. Code operates the document.",
        }),
      ).toBeVisible();
    },
    4000,
  );
  if (errors.length) throw new Error(errors.join("\n"));
  succeeded = true;
} finally {
  await page.screenshot({ path: `${out}/final-state.png` });
  const video = page.video();
  await context.close();
  await writeFile(
    `${out}/timeline.json`,
    JSON.stringify(
      {
        origin,
        browser: browser.version(),
        prefix: "superdoc-jev-guided",
        raw: await video!.path(),
        shots,
        measured,
        errors: succeeded ? errors : [...errors, "Recording did not complete"],
        socialShots: [shots[0], shots[2], shots[4], shots[5], shots[8]]
          .filter(Boolean)
          .map((s) => ({
            ...s,
            start: Math.max(s.start, s.end - 5),
            wait: false,
          })),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
