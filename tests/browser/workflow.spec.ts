import { test, expect } from "@playwright/test";
import { MODELS } from "../../lib/compare/types";
test("workflow copies produce matching verified redlines, protect the active document, and export reviewable files", async ({
  page,
}, info) => {
  await page.route("**/api/compare/workflow/start", (route) =>
    route.fulfill({ json: { runId: "test-run", snapshot: "frozen-test" } }),
  );
  await page.route("**/api/compare/workflow/model", (route) => {
    const b = route.request().postDataJSON();
    return route.fulfill({
      json: {
        model: b.model,
        snapshot: "frozen-test",
        status: "complete",
        elapsedMs: 20,
        usage: {
          inputTokens: 1000,
          outputTokens: 50,
          cachedInputTokens: 0,
          costUsd: b.model === MODELS[0] ? 0.000042 : 0.001,
          pricingDate: "2026-09-22",
        },
        verdicts: b.input.rows.map((r: { id: string }) => ({
          id: r.id,
          verdict:
            r.id === "payment"
              ? "ACCEPTABLE"
              : ["safeguard", "signals", "liability"].includes(r.id)
                ? "NEEDS_REVIEW"
                : "UNACCEPTABLE",
        })),
      },
    });
  });
  await page.route("**/api/compare/workflow/finish", (route) =>
    route.fulfill({ json: { closed: true } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  const before = await page.evaluate(async () => {
    const d = window.__dealDesk!;
    return d.read(d.instance.activeEditor!.doc!, {
      training: "consent",
      notice: 30,
    });
  });
  await page
    .getByRole("button", { name: "Compare time & cost", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Approve language & compare",
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("checkbox", { name: /Also approve/ }).check();
  await page
    .getByRole("button", { name: "Approve language & compare", exact: true })
    .click();
  await expect(
    page
      .locator(".model-card h4")
      .filter({ hasText: "5 verified Word changes" }),
  ).toHaveCount(3, { timeout: 60000 });
  await expect(
    page.getByText("✓ Same approved changes verified", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("95.8% lower model cost", { exact: true }),
  ).toBeVisible();
  const after = await page.evaluate(async () => {
    const d = window.__dealDesk!;
    return d.read(d.instance.activeEditor!.doc!, {
      training: "consent",
      notice: 30,
    });
  });
  expect(after).toEqual(before);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download DOCX", exact: true })
    .first()
    .click();
  const file = info.outputPath("workflow.docx");
  await (await download).saveAs(file);
  await page
    .getByRole("button", { name: "Inspect Word output", exact: true })
    .first()
    .click();
  await expect(
    page
      .locator(".workflow-preview-document")
      .getByText("Software subscription agreement", { exact: true })
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("workflow-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText("95.8% lower model cost", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Compare time and cost" }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Compare time & cost", exact: true })
    .click();
  await expect(
    page.getByText("95.8% lower model cost", { exact: true }),
  ).toBeVisible();
});
test("different model outcomes do not unlock savings", async ({ page }) => {
  await page.route("**/api/compare/workflow/start", (r) =>
    r.fulfill({ json: { runId: "test", snapshot: "s" } }),
  );
  await page.route("**/api/compare/workflow/model", (r) => {
    const b = r.request().postDataJSON();
    return r.fulfill({
      json: {
        model: b.model,
        snapshot: "s",
        status: b.model === MODELS[2] ? "incomplete" : "complete",
        elapsedMs: 1,
        usage: null,
        verdicts: b.input.rows.map((v: { id: string }) => ({
          id: v.id,
          verdict: b.model === MODELS[1] ? "ACCEPTABLE" : "UNACCEPTABLE",
        })),
      },
    });
  });
  await page.route("**/api/compare/workflow/finish", (r) =>
    r.fulfill({ json: { closed: true } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Compare time & cost", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Approve language & compare",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Approve language & compare", exact: true })
    .click();
  await expect(
    page.getByText("Comparison finished.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByText("Outcomes differ or need attention", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".savings-grid strong")).toHaveText(["—", "—"]);
});
