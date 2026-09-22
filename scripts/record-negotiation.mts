/** Record the actual live negotiation. No replay or simulated provider responses. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const origin = process.env.DEMO_BASE_URL || "http://localhost:5173";
const out = resolve(process.env.VIDEO_OUTPUT_DIR || "outputs/video-v2");
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  recordVideo: { dir: out, size: { width: 1600, height: 1080 } },
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
const measured: unknown[] = [];
const shots: { start: number; end: number; caption: string; wait: boolean }[] =
  [];
const start = performance.now();
const time = () => (performance.now() - start) / 1000;
async function shot(
  caption: string,
  action: () => Promise<unknown>,
  hold = 4400,
) {
  const s = time();
  await action();
  await page.waitForTimeout(hold);
  shots.push({ start: s, end: time(), caption, wait: false });
}
async function review(label: string) {
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/negotiate"),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  const r = await response;
  const body = await r.json();
  if (!r.ok()) throw new Error(JSON.stringify(body));
  measured.push({ type: "complete", ...body });
  await expect(
    page.getByRole("button", { name: "Rerun review", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
}
try {
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Prepare counterproposal", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await shot(
    "A returned Word agreement. Counsel’s edits and comments are already inside.",
    async () => {
      await page.locator("[data-location=schedule] .location-button").click();
    },
  );
  await shot(
    "One deal instruction connects the agreement, order form, and data schedule.",
    async () => {
      await page.locator(".deal-scroll").evaluate((el) => (el.scrollTop = 0));
    },
    5000,
  );
  await shot(
    "Jev evaluates the actual clauses. These are live model responses.",
    () => review("Prepare counterproposal"),
    4000,
  );
  await shot(
    "An existing counsel edit overlaps. You decide how to resolve it.",
    async () => {
      await page.locator("[data-location=schedule] .location-button").click();
      await page
        .getByRole("button", { name: "Accept counsel’s edit", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Review current text", exact: true }),
      ).toBeEnabled();
    },
    4200,
  );
  await shot(
    "Prepare the connected proposal against the current document.",
    () => review("Review current text"),
    3000,
  );
  await shot(
    "A lawyer adds a sentence before the agent applies its proposal.",
    async () => {
      await page.locator("[data-location=body] .location-button").click();
      await page
        .getByRole("button", { name: "Edit this clause yourself", exact: true })
        .click();
      const input = page.getByLabel("Your clause edit");
      await input.fill(
        (await input.inputValue()) +
          " The parties will confirm this allocation in writing.",
      );
      await page
        .getByRole("button", { name: "Save my edit", exact: true })
        .click();
    },
    4200,
  );
  await shot(
    "SuperDoc guards document state. The outdated proposal cannot overwrite your edit.",
    async () => {
      await page
        .getByRole("button", {
          name: "Check proposal against current text",
          exact: true,
        })
        .click();
      await expect(page.getByRole("alert")).toContainText("Proposal paused");
      await page.locator(".deal-scroll").evaluate((el) => (el.scrollTop = 0));
    },
    5000,
  );
  await shot(
    "Fresh review keeps the lawyer’s sentence and updates the proposal.",
    () => review("Review current text"),
    3000,
  );
  await shot(
    "One tracked operation plan. Three locations verified. Existing revisions preserved.",
    async () => {
      await page
        .getByRole("button", {
          name: "Propose 3 connected changes",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("3 document locations verified", { exact: true }),
      ).toBeVisible();
      await page.locator("[data-location=body] .location-button").click();
    },
    5200,
  );
  await shot(
    "The order-form table receives real Word redlines, too.",
    () => page.locator("[data-location=order] .location-button").click(),
    4500,
  );
  await shot(
    "The schedule carries its redline and anchored explanation.",
    () => page.locator("[data-location=schedule] .location-button").click(),
    4500,
  );
  await shot(
    "People remain in control: accept one change, reject another.",
    async () => {
      await page.locator("[data-location=body] .location-button").click();
      await page
        .getByRole("button", { name: "Accept change", exact: true })
        .click();
      await page.locator("[data-location=order] .location-button").click();
      await page
        .getByRole("button", { name: "Reject change", exact: true })
        .click();
      await expect(
        page.getByText(/These locations are no longer aligned/),
      ).toBeVisible();
    },
    4500,
  );
  await shot(
    "Return a real Word counterproposal—with comments and unresolved redlines.",
    async () => {
      await page.locator("[data-location=schedule] .location-button").click();
      const d = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download Word", exact: true })
        .click();
      await (await d).saveAs(`${out}/negotiated-agreement.docx`);
    },
    5000,
  );
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await page.screenshot({ path: `${out}/final-state.png` });
  const video = page.video();
  await context.close();
  const raw = await video!.path();
  await writeFile(
    `${out}/timeline.json`,
    JSON.stringify(
      {
        origin,
        browser: browser.version(),
        prefix: "superdoc-jev-negotiation",
        raw,
        shots,
        measured,
        errors,
        socialShots: [shots[0], shots[8], shots[9], shots[6], shots[12]]
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
