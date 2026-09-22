/** Real provider/UI proof. No mocked decisions. Uses three of the hourly reviews. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const out = "outputs/negotiation-live";
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1080 } });
const runs: unknown[] = [];
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
async function review(label: string) {
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/negotiate"),
  );
  await page.getByRole("button", { name: label, exact: true }).click();
  const r = await response,
    body = await r.json();
  runs.push(body);
  if (!r.ok()) throw new Error(JSON.stringify(body));
  await expect(
    page.getByRole("button", { name: "Rerun review", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
}
try {
  await page.goto(process.env.DEMO_BASE_URL || "http://localhost:5173");
  await expect(
    page.getByRole("button", { name: "Prepare counterproposal", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await page.screenshot({ path: `${out}/opening.png` });
  await review("Prepare counterproposal");
  await page.locator("[data-location=schedule] .location-button").click();
  await expect(
    page.getByText("Counsel has an unresolved edit here."),
  ).toBeVisible();
  await page.screenshot({ path: `${out}/counsel-overlap.png` });
  await page
    .getByRole("button", { name: "Accept counsel’s edit", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review current text", exact: true }),
  ).toBeEnabled();
  await review("Review current text");
  await expect(
    page.getByRole("button", {
      name: "Propose 3 connected changes",
      exact: true,
    }),
  ).toBeEnabled();
  await page.locator("[data-location=body] .location-button").click();
  await page
    .getByRole("button", { name: "Edit this clause yourself", exact: true })
    .click();
  const field = page.getByLabel("Your clause edit");
  const old = await field.inputValue();
  await field.fill(
    old + " The parties will confirm this allocation in writing.",
  );
  await page.getByRole("button", { name: "Save my edit", exact: true }).click();
  await expect(
    page.getByText("Your work is protected.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Check proposal against current text",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText("Proposal paused");
  await page.screenshot({ path: `${out}/stale-proposal.png` });
  await review("Review current text");
  await page
    .getByRole("button", { name: "Propose 3 connected changes", exact: true })
    .click();
  await expect(
    page.getByText("3 document locations verified", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${out}/verified-redlines.png` });
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
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .click();
  await (await download).saveAs(`${out}/live-counterproposal.docx`);
  await page.screenshot({ path: `${out}/partial-review.png` });
  await writeFile(
    `${out}/measurements.json`,
    JSON.stringify(
      {
        source: process.env.DEMO_BASE_URL || "http://localhost:5173",
        runs,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ runs, errors }));
} finally {
  await page.screenshot({ path: `${out}/last-state.png` });
  await browser.close();
}
