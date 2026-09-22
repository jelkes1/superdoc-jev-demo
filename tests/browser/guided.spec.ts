import { test, expect, type Page } from "@playwright/test";
import type { RuleId } from "../../lib/deal-desk/rules";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
}
async function reviewMock(page: Page, acceptable = false) {
  await page.route("**/api/deal-desk", async (route) => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      json: {
        revision: body.revision,
        version: body.version,
        reviewId: "test-review",
        decisions: body.rows.map((r: { id: RuleId }) => ({
          id: r.id,
          verdict:
            acceptable || r.id === "payment"
              ? "ACCEPTABLE"
              : ["safeguard", "signals", "liability"].includes(r.id)
                ? "NEEDS_REVIEW"
                : "UNACCEPTABLE",
          confidence: 0.99,
          probabilities: {
            ACCEPTABLE: 0.003,
            UNACCEPTABLE: 0.99,
            NEEDS_REVIEW: 0.004,
            NOT_APPLICABLE: 0.003,
          },
          model: "test-only",
        })),
        usage: {
          decisions: body.rows.length,
          latencyMs: 10,
          inputTokens: 100,
          outputTokens: 20,
          costUsd: 0.00001,
        },
      },
    });
  });
  await page
    .getByRole("checkbox", {
      name: "Send extracted clause text to TypeSafe for this review.",
    })
    .check();
  await page
    .getByRole("button", { name: "Review agreement", exact: true })
    .click();
}
test("guided journey keeps the document visible, resumes exploration, exports pending findings and real redlines", async ({
  page,
}, info) => {
  await ready(page);
  await reviewMock(page);
  await expect(
    page.getByRole("heading", { name: "Approve the proposed language." }),
  ).toBeVisible();
  await expect(page.locator(".document-surface")).toBeVisible();
  await expect(page.locator(".guided-proposal")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Explore freely", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to guided flow", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Approve the proposed language." }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Approve selected language & create redlines",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review each finding." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /4 verified Word changes/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.getByRole("button", { name: "Next finding", exact: true }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page
    .locator(".guided-queue")
    .getByRole("button", { name: /Numbered safeguard/ })
    .click();
  await page
    .getByRole("button", { name: "Approve numbered insertion" })
    .click();
  await expect(
    page.getByRole("heading", { name: /5 verified Word changes/ }),
  ).toBeVisible();
  await page
    .locator(".guided-queue")
    .getByRole("button", { name: /Telemetry exception/ })
    .click();
  await page.getByRole("button", { name: "Leave for human review" }).click();
  await page
    .getByRole("button", { name: "Continue to export with remaining items" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your Word counterproposal." }),
  ).toBeVisible();
  await expect(page.locator(".export-counts")).toContainText("Pending3");
  await page.screenshot({
    path: info.outputPath("guided-export.png"),
    fullPage: false,
  });
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .click();
  await (await downloaded).saveAs(info.outputPath("guided-reviewed.docx"));
});
test("zero proposals and provider failure have a next action; mobile keyboard flow stays within viewport", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await reviewMock(page, true);
  await expect(
    page.getByText("No supported replacements are ready.", { exact: false }),
  ).toBeVisible();
  const next = page.getByRole("button", {
    name: "Continue to findings",
    exact: true,
  });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Review each finding." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("guided-mobile.png"),
    fullPage: false,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/deal-desk", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Provider unavailable in this test." },
    }),
  );
  await page
    .getByRole("checkbox", {
      name: "Send extracted clause text to TypeSafe for this review.",
    })
    .check();
  await page
    .getByRole("button", { name: "Review agreement", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Continue to export without a new review",
    }),
  ).toBeVisible();
});
test("comparison requires its own consent, reports partial failures and cannot alter document or main usage", async ({
  page,
}) => {
  await ready(page);
  const before = await page.evaluate(
    async () =>
      (await window.__dealDesk!.instance.activeEditor!.doc!.info({})).revision,
  );
  await page
    .getByRole("button", { name: "Compare models", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Run fresh comparison" }),
  ).toBeDisabled();
  await page.route("**/api/compare", async (route) => {
    expect(route.request().headers()["x-comparison-consent"]).toBe(
      "acknowledged",
    );
    const models = [
      "jev-1.13.0",
      "gpt-5.4-mini-2026-03-17",
      "gpt-5.4-2026-03-05",
    ];
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        [
          {
            type: "start",
            snapshot: "test-frozen",
            revision: before,
            version: "test",
            models,
            pricingDate: "2026-09-22",
            settings: "Test-only responses",
          },
          ...models.map((model, i) => ({
            type: "result",
            result: {
              model,
              snapshot: "test-frozen",
              status: i === 2 ? "incomplete" : "complete",
              elapsedMs: 20 + i,
              usage:
                i === 2
                  ? null
                  : {
                      inputTokens: 10,
                      outputTokens: 2,
                      cachedInputTokens: 0,
                      costUsd: 0.0001,
                    },
              verdicts:
                i === 2
                  ? []
                  : [
                      {
                        id: "training",
                        verdict: i ? "NEEDS_REVIEW" : "UNACCEPTABLE",
                      },
                    ],
              ...(i === 2 ? { error: "Unavailable test provider" } : {}),
            },
          })),
          { type: "complete", snapshot: "test-frozen", budgetSettled: true },
        ]
          .map((x) => JSON.stringify(x))
          .join("\n") + "\n",
    });
  });
  await page
    .getByRole("checkbox", {
      name: /I agree to send this extracted contract text/,
    })
    .check();
  await page.getByRole("button", { name: "Run fresh comparison" }).click();
  await expect(
    page.getByRole("cell", { name: "incomplete", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Unknown", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /0 verified Word changes/ }),
  ).toContainText("$0.000000");
  const after = await page.evaluate(
    async () =>
      (await window.__dealDesk!.instance.activeEditor!.doc!.info({})).revision,
  );
  expect(after).toBe(before);
});
