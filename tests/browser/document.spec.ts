import { test, expect } from "@playwright/test";
import type { Suggestion } from "../../lib/review/types";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Review against playbook", exact: true }),
  ).toBeEnabled();
  await page.waitForFunction(() => !!window.__demo?.instance.activeEditor?.doc);
});
test("three real tracked replacements, rerun, acceptance and existing revisions", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const d = window.__demo!,
      api = d.instance.activeEditor!.doc!;
    let snapshot = await d.extract(api);
    let expected = snapshot.revision;
    const own: Suggestion[] = [];
    for (const [prefix, old, next] of [
      ["Each party’s aggregate liability", "18 months", "12 months"],
      ["Customer shall pay each undisputed invoice", "45 days", "30 days"],
      ["The subscription automatically renews", "15 days", "30 days"],
    ]) {
      const c = snapshot.clauses.find((c) => c.text.startsWith(prefix))!;
      const s = await d.apply(
        api,
        c,
        {
          original: c.text,
          replacement: c.text.replace(old, next),
          source: "playbook",
          explanation: "Integration test",
        },
        c.id,
        expected,
      );
      expected = s.verification.afterRevision;
      own.push(s);
    }
    const statuses = own.map((s) => s.status);
    await api.trackChanges.decide(
      {
        decision: "accept",
        target: { kind: "ids", ids: own[0].verification.changeIds },
      },
      { expectedRevision: expected },
    );
    own[0].status = "accepted";
    snapshot = await d.extract(api);
    const externalClause = snapshot.clauses.find((c) =>
      c.text.startsWith("Customer Data means"),
    )!;
    const external = await d.apply(
      api,
      externalClause,
      {
        original: externalClause.text,
        replacement: externalClause.text.replace(
          "files, text",
          "files, records, text",
        ),
        source: "playbook",
        explanation: "Existing human revision",
      },
      "external",
      snapshot.revision,
    );
    await d.clear(api, own);
    const remaining = await d.changes(api);
    snapshot = await d.extract(api);
    const cap = snapshot.clauses.find((c) =>
      c.text.startsWith("Each party’s aggregate liability"),
    )!.text;
    const payment = snapshot.clauses.find((c) =>
      c.text.startsWith("Customer shall pay each undisputed invoice"),
    )!;
    const rerun = await d.apply(
      api,
      payment,
      {
        original: payment.text,
        replacement: payment.text.replace("45 days", "30 days"),
        source: "playbook",
        explanation: "Rerun",
      },
      payment.id,
      snapshot.revision,
    );
    const after = await d.changes(api);
    return {
      statuses,
      remaining: remaining.map((c) => c.id),
      external: external.verification.changeIds,
      cap,
      rerun: rerun.status,
      afterCount: after.length,
    };
  });
  expect(result.statuses).toEqual(["pending", "pending", "pending"]);
  expect(result.remaining).toEqual(result.external);
  expect(result.cap).toContain("12 months");
  expect(result.rerun).toBe("pending");
  expect(result.afterCount).toBe(2);
});
test("stale review and duplicate target are rejected", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const d = window.__demo!,
      api = d.instance.activeEditor!.doc!,
      snapshot = await d.extract(api),
      c = snapshot.clauses.find((c) =>
        c.text.startsWith("Customer shall pay each undisputed invoice"),
      )!;
    const proposal = {
      original: c.text,
      replacement: c.text.replace("45 days", "30 days"),
      source: "playbook" as const,
      explanation: "test",
    };
    let stale = "",
      duplicate = "";
    try {
      await d.apply(api, c, proposal, "stale", "999");
    } catch (e) {
      stale = (e as Error).message;
    }
    const s = await d.apply(api, c, proposal, "one", snapshot.revision);
    try {
      await d.apply(api, c, proposal, "two", s.verification.afterRevision);
    } catch (e) {
      duplicate = (e as Error).message;
    }
    return { stale, duplicate, count: (await d.changes(api)).length };
  });
  expect(result.stale).toMatch(/changed after review/);
  expect(result.duplicate).toMatch(/already contains/);
  expect(result.count).toBe(1);
});
test("user-edited pending suggestion blocks automatic replacement", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const d = window.__demo!,
      api = d.instance.activeEditor!.doc!,
      snapshot = await d.extract(api),
      c = snapshot.clauses.find((c) =>
        c.text.startsWith("Customer shall pay each undisputed invoice"),
      )!;
    const s = await d.apply(
      api,
      c,
      {
        original: c.text,
        replacement: c.text.replace("45 days", "30 days"),
        source: "playbook",
        explanation: "test",
      },
      "payment",
      snapshot.revision,
    );
    const match = await api.query.match({
      select: { type: "text", pattern: "30 days" },
      within: { kind: "block", nodeType: "paragraph", nodeId: c.nodeId },
      require: "exactlyOne",
    });
    if (match.items[0].matchKind !== "text") throw new Error("Missing match");
    await api.replace(
      { target: match.items[0].target, text: "60 days" },
      {
        changeMode: "tracked",
        expectedRevision: (await api.info({})).revision,
      },
    );
    try {
      await d.clear(api, [s]);
      return { blocked: false };
    } catch (e) {
      return { blocked: true, message: (e as Error).message };
    }
  });
  expect(result.blocked).toBe(true);
});
test("exported DOCX reopens with tracked change, tables and numbered headings", async ({
  page,
}, testInfo) => {
  const path = testInfo.outputPath("redlined-agreement.docx");
  await page.evaluate(async () => {
    const d = window.__demo!,
      api = d.instance.activeEditor!.doc!,
      snapshot = await d.extract(api),
      c = snapshot.clauses.find((c) =>
        c.text.startsWith("Each party’s aggregate liability"),
      )!;
    const s = await d.apply(
      api,
      c,
      {
        original: c.text,
        replacement: c.text.replace("18 months", "12 months"),
        source: "playbook",
        explanation: "test",
      },
      "liability",
      snapshot.revision,
    );
    if (s.status !== "pending") throw new Error("Unverified mutation");
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  await (await downloadPromise).saveAs(path);
  await page.locator("input[type=file]").setInputFiles(path);
  await expect(
    page.getByRole("button", { name: "Review against playbook", exact: true }),
  ).toBeEnabled();
  const reopened = await page.evaluate(async () => {
    const d = window.__demo!,
      api = d.instance.activeEditor!.doc!;
    return { changes: await d.changes(api), info: await api.info({}) };
  });
  expect(reopened.changes).toHaveLength(1);
  expect(reopened.changes[0].insertedText).toBe("12");
  expect(reopened.changes[0].deletedText).toBe("18");
  expect(reopened.info.counts.tables).toBe(3);
  expect(
    reopened.info.outline.some((c) => c.text === "6.1  Aggregate cap"),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("reopened.png") });
});
test("oversized upload and unavailable live provider are explicit", async ({
  page,
}) => {
  await page.locator("input[type=file]").setInputFiles({
    name: "large.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("alert")).toContainText("10 MB");
  const status = await page.request.get("/api/status");
  const data = await status.json();
  if (!data.jev) {
    await page
      .getByRole("button", { name: "Review against playbook", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("No model results");
  }
});
