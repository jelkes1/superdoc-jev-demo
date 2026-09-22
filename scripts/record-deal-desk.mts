/** Genuine hosted run. Never stubs provider calls or changes screenshot pixels. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const origin = process.env.DEMO_BASE_URL || "http://localhost:5173";
const out = resolve(process.env.VIDEO_OUTPUT_DIR || "outputs/video-v3");
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
  hold = 3800,
  wait = false,
) {
  const s = time();
  await action();
  await page.waitForTimeout(hold);
  shots.push({ start: s, end: time(), caption, wait });
}
async function check(first = false) {
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/deal-desk"),
  );
  await page
    .getByRole("button", {
      name: first ? "Review the agreement" : "Recheck changed clauses",
      exact: true,
    })
    .click();
  const r = await response;
  const body = await r.json();
  if (!r.ok()) throw new Error(body.error);
  measured.push({ type: "complete", ...body });
  await expect(
    page.getByRole("button", { name: "Recheck changed clauses", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
}
try {
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await shot(
    "Start with a real Word agreement. Counsel’s negotiated revisions are already inside.",
    () => page.getByRole("button", { name: /Agreed payment terms/ }).click(),
  );
  await shot(
    "Jev checks eight locations against the agreed terms. Actual decisions and probabilities.",
    async () => {
      await check(true);
      await page
        .getByRole("button", { name: "Review matrix", exact: true })
        .click();
    },
    4000,
  );
  await shot(
    "Review the proposed language. Lower-confidence decisions require your approval.",
    async () => {
      await page.locator(".approval-sheet").scrollIntoViewIfNeeded();
    },
    3600,
  );
  await shot(
    "SuperDoc turns approved language into verified Word redlines, with anchored explanations.",
    async () => {
      await page
        .getByRole("button", {
          name: "Approve language & propose 4 redlines",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Recheck changed clauses",
          exact: true,
        }),
      ).toBeEnabled({ timeout: 60000 });
      await expect(
        page.getByText("Tracked edit verified", { exact: true }),
      ).toBeVisible();
    },
    3800,
  );
  await shot(
    "The order-form cell changes in place. Its table stays editable.",
    () => page.getByRole("button", { name: /Order-form permission/ }).click(),
    3800,
  );
  await shot(
    "Approve a missing safeguard. It becomes a real numbered item with a tracked structural revision.",
    async () => {
      await page.getByRole("button", { name: /Numbered safeguard/ }).click();
      await page
        .getByRole("button", {
          name: "Add as tracked change",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Recheck changed clauses",
          exact: true,
        }),
      ).toBeEnabled();
      await expect(
        page.getByText("Tracked edit verified", { exact: true }),
      ).toBeVisible();
    },
    4200,
  );
  await shot(
    "Recheck the changed context. Unchanged decisions are reused.",
    () => check(),
    2600,
  );
  await shot(
    "The telemetry exception is unresolved. A reasoning draft helps; a human still decides.",
    async () => {
      await page.getByRole("button", { name: /Telemetry exception/ }).click();
      const request = page.getByRole("button", {
        name: "Ask reasoning model for a draft",
        exact: true,
      });
      if (await request.count()) {
        const response = page.waitForResponse((r) =>
          r.url().endsWith("/api/reason"),
        );
        await request.click();
        const r = await response;
        const body = await r.json();
        if (!r.ok()) throw new Error(body.error);
        measured.push({ type: "reasoning", ...body });
        await expect(
          page.getByText("gpt-5.4 · Draft for review", { exact: true }),
        ).toBeVisible({ timeout: 80000 });
        await page.locator(".reasoned-draft").scrollIntoViewIfNeeded();
      }
    },
    3000,
    true,
  );
  await shot(
    "People remain in control. Accept one proposal; reject another.",
    async () => {
      await page.getByRole("button", { name: /Training permission/ }).click();
      await page.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(
        page.getByRole("button", {
          name: "Recheck changed clauses",
          exact: true,
        }),
      ).toBeEnabled();
      await page.getByRole("button", { name: /Cancellation window/ }).click();
      await page.getByRole("button", { name: "Reject", exact: true }).click();
      await expect(
        page.getByRole("button", {
          name: "Recheck changed clauses",
          exact: true,
        }),
      ).toBeEnabled();
    },
    3200,
  );
  await shot(
    "A counter-edit changes the actual document. Its old judgment is now stale.",
    async () => {
      await page.getByText("Try a counter-edit", { exact: true }).click();
      await page
        .getByRole("button", { name: "Edit this clause", exact: true })
        .click();
      const t = page.getByRole("textbox", { name: "Counter-edit text" });
      await t.fill((await t.inputValue()).replace("15 days", "60 days"));
      await page
        .getByRole("button", { name: "Save into DOCX", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Recheck changed clauses",
          exact: true,
        }),
      ).toBeEnabled();
    },
    3200,
  );
  await shot(
    "Inspect the operation: exact target, revision guard, receipt and preserved history.",
    async () => {
      await page.getByRole("button", { name: /Order-form permission/ }).click();
      await page
        .getByRole("button", { name: "Execution", exact: true })
        .click();
    },
    3800,
  );
  await shot(
    "Return a Word file with unresolved redlines and comments. Reuse the same operations headlessly.",
    async () => {
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download Word", exact: true })
        .click();
      await (await download).saveAs(`${out}/reviewed-agreement.docx`);
    },
    4000,
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
        prefix: "superdoc-jev-deal-desk",
        raw,
        shots,
        measured,
        errors,
        socialShots: [shots[1], shots[3], shots[4], shots[5], shots[11]]
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
