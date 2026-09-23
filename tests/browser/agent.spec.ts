import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Lane, Edit } from "../../lib/agent/types";
const report = JSON.parse(
  await readFile("docs/agent-evaluation-v1.json", "utf8"),
) as { runs: { case: string; repetition: number; lane: Lane }[] };
async function mockPlanning(page: Page) {
  let count = 0;
  await page.route("**/api/agent/start", async (r) => {
    count++;
    await r.fulfill({ json: { runId: "test-run", snapshot: "test-snapshot" } });
  });
  await page.route("**/api/agent/finish", async (r) =>
    r.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/agent/plan", async (r) => {
    const { pipeline } = r.request().postDataJSON();
    const result = report.runs.find(
      (x) =>
        x.case === "renewal" &&
        x.repetition === 1 &&
        x.lane.pipeline === pipeline,
    )!.lane.result;
    await r.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  return () => count;
}
async function open(page: Page) {
  await page.addInitScript({ content: "window.__name=(fn)=>fn;" });
  await page.goto("/agent");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
}
test("guided agent uses explicit approval, no-change recheck, review and export with existing revisions", async ({
  page,
}) => {
  const count = await mockPlanning(page);
  await open(page);
  await expect(page.getByRole("tab", { name: /Review/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".agent-existing")).toHaveCount(2);
  await page.getByRole("button", { name: "Renewal notice ↗" }).click();
  await page
    .getByRole("button", { name: "Propose changes", exact: true })
    .click();
  await expect(page.locator(".agent-proposal")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Propose changes", exact: true })
    .click();
  await expect(
    page.getByText("Nothing changed. No model call was made."),
  ).toBeVisible();
  expect(count()).toBe(1);
  await page
    .getByRole("button", {
      name: "Approve selected language & create redlines",
    })
    .click();
  await expect(page.getByText("Verified tracked edit · pending")).toHaveCount(
    2,
  );
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Verified tracked edit · accepted"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(
    page.getByText("Verified tracked edit · rejected"),
  ).toBeVisible();
  await expect(page.locator(".agent-existing")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "superdoc-agent-reviewed.docx",
  );
});
test("comparison creates independent copies, shows equivalence only after both approvals", async ({
  page,
}) => {
  test.setTimeout(120000);
  await mockPlanning(page);
  await open(page);
  await page.getByRole("tab", { name: "AI", exact: true }).click();
  await page
    .getByRole("button", { name: "Compare approaches", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Approve selected language & create redlines",
    }),
  ).toBeEnabled({ timeout: 60000 });
  await page
    .getByRole("button", {
      name: "Approve selected language & create redlines",
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Inspect this Word copy" }),
  ).toBeVisible();
  await expect(
    page.getByText("not established", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Full context", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Approve selected language & create redlines",
    })
    .click();
  await expect(
    page.getByText("fixture checks passed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspect this Word copy" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close preview" }).click();
  await page.getByRole("tab", { name: /Review/ }).click();
  await expect(page.locator(".agent-existing")).toHaveCount(2);
});
test("real document guards stale targets, unsupported operations, modified suggestions and anchored comments", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const w = window as unknown as {
        __agent: { editor: import("superdoc").SuperDoc };
      },
      doc = w.__agent.editor.activeEditor!.doc!;
    const path = "/lib/agent/document.ts";
    const mod = (await import(
      /* @vite-ignore */ path
    )) as typeof import("../../lib/agent/document");
    let s = await mod.documentIndex(
      doc,
      "Change renewal notice",
      "0".repeat(64),
    );
    const b = s.blocks.find((b) => b.text === "Non-renewal notice: 15 days.")!;
    const edit: Edit = {
      id: "r",
      tool: "replace",
      blockId: b.id,
      original: "15",
      replacement: "60",
      explanation: "Renewal",
    };
    const out: Record<string, boolean> = {};
    try {
      await mod.executeEdit(doc, s, edit, "stale");
    } catch {
      out.stale = true;
    }
    try {
      await mod.executeEdit(
        doc,
        s,
        { ...edit, tool: "delete-document" } as unknown as Edit,
        s.revision,
      );
    } catch {
      out.unsupported = true;
    }
    const op = await mod.executeEdit(doc, s, edit, s.revision);
    out.verified = op.verified;
    try {
      await mod.executeEdit(doc, s, edit, op.afterRevision);
    } catch {
      out.duplicate = true;
    }
    await doc.trackChanges.decide(
      { decision: "accept", target: { kind: "ids", ids: op.changeIds } },
      { expectedRevision: (await doc.info({})).revision },
    );
    try {
      await mod.guardExecution(doc, s, op);
    } catch {
      out.modified = true;
    }
    s = await mod.documentIndex(doc, "Add anchored comment", "0".repeat(64));
    const current = s.blocks.find((x) => x.id === b.id)!,
      comment = {
        id: "c",
        tool: "comment" as const,
        blockId: b.id,
        original: current.text,
        replacement: "Please confirm the agreed renewal period.",
        explanation: "Review note",
      };
    const c = await mod.executeEdit(doc, s, comment, s.revision);
    out.comment = c.commentVerified;
    await mod.decideEdit(doc, s, c, "reject");
    out.commentDeleted = !(await doc.comments.list({ limit: 1000 })).items.some(
      (x) => x.id === c.commentId,
    );
    return out;
  });
  expect(result).toEqual({
    stale: true,
    unsupported: true,
    verified: true,
    duplicate: true,
    modified: true,
    comment: true,
    commentDeleted: true,
  });
});
test("keyboard tabs and narrow screen keep the agent navigable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("tab", { name: /Review/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "AI", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("What should change?")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
