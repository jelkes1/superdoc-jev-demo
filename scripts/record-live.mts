/** Records real model runs only. Exits before recording if Jev is unavailable. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const origin = process.env.DEMO_BASE_URL || "http://localhost:5173";
const out = resolve(process.env.VIDEO_OUTPUT_DIR || "outputs/video");
const status = (await fetch(`${origin}/api/status`).then((r) => r.json())) as {
  jev: boolean;
};
if (!status.jev)
  throw new Error(
    "Live Jev access is not configured. No recording was made. Do not substitute test responses.",
  );
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1080 },
  recordVideo: { dir: out, size: { width: 1600, height: 1080 } },
});
const page = await context.newPage();
const shots: { start: number; end: number; caption: string; wait: boolean }[] =
  [];
const measured: unknown[] = [];
const epoch = performance.now();
const seconds = () => (performance.now() - epoch) / 1000;
page.on("response", async (response) => {
  if (response.url().endsWith("/api/review") && response.ok()) {
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((x) => JSON.parse(x));
    measured.push(
      ...events.filter((e) => e.type === "complete" || e.type === "start"),
    );
  }
});
async function shot(
  caption: string,
  action: () => Promise<unknown>,
  wait = false,
) {
  const start = seconds();
  await action();
  await page.waitForTimeout(
    wait ? Math.max(0, 6000 - (seconds() - start) * 1000) : 6000,
  );
  shots.push({ start, end: seconds(), caption, wait });
}
try {
  await page.goto(origin);
  await expect(
    page.getByRole("button", { name: "Review against playbook", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await shot(
    "A real Word contract. Five explicit vendor policies.",
    async () => {},
  );
  await shot(
    "Jev evaluates the clauses against the playbook.",
    async () => {
      await page
        .getByRole("button", { name: "Review against playbook", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Review complete", {
        timeout: 240000,
      });
    },
    true,
  );
  const liability = page
    .locator("[data-rule=liability]")
    .filter({ hasText: "Verified tracked replacement" })
    .first();
  await expect(liability).toBeVisible();
  await shot("A decision becomes a tracked Word redline.", () =>
    liability.getByRole("button", { name: "Limitation of liability" }).click(),
  );
  await shot(
    "SuperDoc verifies the old text, new text and tracked revision.",
    async () => {
      await liability.getByText("Decision details").click();
    },
  );
  const ambiguous = page.locator("[data-verdict=NEEDS_REVIEW]").first();
  await expect(ambiguous).toBeVisible();
  await shot("Uncertain findings stay open for human review.", () =>
    ambiguous.locator(".finding-location").click(),
  );
  await shot("Change the liability policy from 12 to 24 months.", async () => {
    await page.getByLabel("Liability cap").selectOption("24");
  });
  await shot(
    "Rerun the policy. Replace only this review’s pending suggestions.",
    async () => {
      await page
        .getByRole("button", { name: "Rerun against playbook", exact: true })
        .click();
      await expect(page.getByRole("status")).toHaveText("Review complete", {
        timeout: 240000,
      });
    },
    true,
  );
  const payment = page
    .locator("[data-rule=payment]")
    .filter({ hasText: "Verified tracked replacement" })
    .first();
  await expect(payment).toBeVisible();
  await shot("You choose which proposed edits to accept.", async () => {
    await payment.locator(".finding-location").click();
    await payment.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(payment).toContainText("Suggestion accepted");
  });
  const renewal = page
    .locator("[data-rule=renewal]")
    .filter({ hasText: "Verified tracked replacement" })
    .first();
  await expect(renewal).toBeVisible();
  await shot("Or reject a change and keep the original wording.", async () => {
    await renewal.locator(".finding-location").click();
    await renewal.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(renewal).toContainText("Suggestion rejected");
  });
  await shot(
    "Download the DOCX. Keep the formatting and unresolved redlines.",
    async () => {
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download", exact: true }).click();
      await (await pending).saveAs(resolve(out, "recorded-agreement.docx"));
    },
  );
  await shot("Jev decides. SuperDoc edits. A human reviews.", async () => {
    await page.locator(".review-pane").evaluate((el) => {
      el.scrollTop = 0;
    });
  });
  const video = page.video()!;
  await context.close();
  const raw = await video.path();
  await writeFile(
    resolve(out, "timeline.json"),
    JSON.stringify(
      {
        raw,
        origin,
        viewport: { width: 1600, height: 1080 },
        browser: browser.version(),
        shots,
        measured,
      },
      null,
      2,
    ),
  );
  console.log(
    `Recorded genuine run: ${raw}. Render captioned cuts with npm run video:render.`,
  );
} catch (e) {
  await context.close();
  throw e;
} finally {
  await browser.close();
}
