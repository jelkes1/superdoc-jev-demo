import { test, expect } from "@playwright/test";
import type { ReviewInput, Decision } from "../../lib/review/types";
// Test-only transport fixtures. No product route or launch recording can enable them.
test("review UI navigates, accepts/rejects and reruns without duplicate proposals", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        jev: true,
        reasoning: true,
        jevModel: "test-transport",
        reasoningModel: "test-transport",
      },
    }),
  );
  await page.route("**/api/review", async (route) => {
    const input = route.request().postDataJSON() as ReviewInput;
    const decisions: Decision[] = [];
    for (const [prefix, ruleId] of [
      ["Each party’s aggregate liability", "liability"],
      ["Customer shall pay each undisputed invoice", "payment"],
      ["The subscription automatically renews", "renewal"],
      ["Provider may use Operational Signals", "data"],
      ["This agreement is governed", "law"],
    ] as const) {
      const c = input.clauses.find((c) => c.text.startsWith(prefix))!;
      const acceptable =
        ruleId === "law" ||
        (ruleId === "liability" && input.playbook.liabilityMonths === 24) ||
        (ruleId === "payment" && c.text.includes("30 days"));
      const verdict =
        ruleId === "data"
          ? "NEEDS_REVIEW"
          : acceptable
            ? "ACCEPTABLE"
            : "UNACCEPTABLE";
      const probabilities = {
        ACCEPTABLE: 0,
        UNACCEPTABLE: 0,
        NEEDS_REVIEW: 0,
        NOT_APPLICABLE: 0,
      };
      probabilities[verdict] = 1;
      decisions.push({
        id: `${c.id}:${ruleId}`,
        clauseId: c.id,
        ruleId,
        verdict,
        confidence: 0.99,
        probabilities,
        revision: input.revision,
        playbookVersion: input.playbook.version,
        model: "test-transport",
        ...(ruleId === "data" ? { reasonToken: "a".repeat(64) } : {}),
      });
    }
    const usage = {
      inputTokens: 500,
      outputTokens: 50,
      costUsd: 0.000021,
      latencyMs: 120,
      decisions: 5,
    };
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: [
        {
          type: "start",
          reviewId: "00000000-0000-4000-8000-000000000000",
          total: 5,
          model: "test-transport",
        },
        { type: "batch", decisions, usage },
        { type: "complete", usage, missingRules: [] },
      ]
        .map((x) => JSON.stringify(x) + "\n")
        .join(""),
    });
  });
  await page.route("**/api/reason", (r) =>
    r.fulfill({
      json: {
        proposal: null,
        explanation: "Unclear scope requires explicit customer instructions.",
        usage: {
          inputTokens: 20,
          outputTokens: 10,
          costUsd: 0.0002,
          latencyMs: 30,
          decisions: 0,
        },
      },
    }),
  );
  await page.goto("/");
  const review = page.getByRole("button", {
    name: "Review against playbook",
    exact: true,
  });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(page.getByRole("status")).toHaveText("Review complete");
  await expect(
    page.getByText("Verified tracked replacement", { exact: true }),
  ).toHaveCount(3);
  await expect(page.locator("[data-rule=data]")).toContainText(
    "human review required",
  );
  const payment = page.locator("[data-rule=payment]");
  await payment.getByRole("button", { name: "Payment terms" }).click();
  await payment.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(payment).toContainText("Suggestion accepted");
  await payment.getByRole("button", { name: "Payment terms" }).click();
  await page.waitForTimeout(300);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Liability cap").selectOption("24");
  await page
    .getByRole("button", { name: "Rerun against playbook", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Review complete");
  await expect(
    page.getByText("Verified tracked replacement", { exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("[data-rule=liability]")).toContainText(
    "ACCEPTABLE",
  );
  const renewal = page.locator("[data-rule=renewal]");
  await renewal.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(renewal).toContainText("Suggestion rejected");
  const text = await page.evaluate(async () =>
    window.__demo!.instance.activeEditor!.doc!.getText({}),
  );
  expect(text).toContain("within 30 days after receipt");
  expect(text).toContain("18 months preceding");
  expect(text).toContain("at least 15 days");
});
test("partial provider failure cannot apply automatic edits", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { jev: true, reasoning: true } }),
  );
  await page.route("**/api/review", (r) =>
    r.fulfill({
      contentType: "application/x-ndjson",
      body: '{"type":"error","message":"Provider temporarily unavailable"}\n',
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Review against playbook", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Review against playbook", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Provider temporarily unavailable",
  );
  expect(
    await page.evaluate(async () =>
      window.__demo!.changes(window.__demo!.instance.activeEditor!.doc!),
    ),
  ).toHaveLength(0);
});
