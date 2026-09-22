import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Prepare counterproposal", exact: true }),
  ).toBeEnabled();
  await page.waitForFunction(
    () => !!window.__negotiation?.instance.activeEditor?.doc,
  );
});
test("atomic tracked proposal preserves counsel history, comments, and Word structure", async ({
  page,
}, info) => {
  const result = await page.evaluate(async () => {
    const n = window.__negotiation!,
      doc = n.instance.activeEditor!.doc!;
    let s = await n.snapshot(doc, { general: 12, data: 24 });
    const imported = {
      changes: s.changes,
      comments: s.comments,
      locations: s.edits.map((e) => ({
        id: e.id,
        text: e.clause?.text,
        existing: e.existing.length,
      })),
      info: await doc.info({}),
    };
    const overlap = s.edits.find((e) => e.id === "schedule")!;
    const decided = await doc.trackChanges.decide(
      {
        decision: "accept",
        target: { kind: "ids", ids: overlap.existing.map((c) => c.id) },
      },
      { expectedRevision: s.revision },
    );
    if (!decided.success) throw new Error(decided.failure.message);
    s = await n.snapshot(doc, { general: 12, data: 24 });
    // Document-operation proof, explicitly human approved; no simulated model response.
    s.edits.forEach((e) => (e.humanApproved = true));
    const { plan, preview } = await n.preview(doc, s);
    const applied = await n.apply(doc, s, plan);
    const after = await n.snapshot(doc, { general: 12, data: 24 });
    return {
      imported,
      preview,
      applied,
      after,
      comments: await doc.comments.list({ limit: 100 }),
    };
  });
  await info.attach("document-proof", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result.imported.changes.length).toBeGreaterThanOrEqual(2);
  expect(result.imported.comments).toBe(2);
  expect(result.imported.locations.every((e) => !!e.text)).toBe(true);
  expect(result.preview.valid).toBe(true);
  expect(result.applied.verified).toBe(true);
  expect(result.applied.suggestions).toHaveLength(3);
  expect(result.applied.comments).toHaveLength(3);
  expect(
    result.after.edits.every((e) => e.clause?.text === e.replacement),
  ).toBe(true);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .click();
  await (await download).saveAs(info.outputPath("counterproposal.docx"));
  await page.screenshot({ path: info.outputPath("counterproposal.png") });
  await page.goto("/playbook");
  await expect(
    page.getByRole("button", { name: "Review against playbook", exact: true }),
  ).toBeEnabled();
  await page
    .locator("input[type=file]")
    .setInputFiles(info.outputPath("counterproposal.docx"));
  await expect(
    page.getByRole("button", { name: "Review against playbook", exact: true }),
  ).toBeEnabled();
  const reopened = await page.evaluate(async () => {
    const api = window.__demo!.instance.activeEditor!.doc!;
    const changes = await window.__demo!.changes(api);
    const info = await api.info({});
    return { changes, info, comments: await api.comments.list({ limit: 100 }) };
  });
  expect(reopened.info.counts.tables).toBe(3);
  expect(reopened.info.counts.lists).toBeGreaterThan(0);
  expect(reopened.info.counts.comments).toBe(5);
  expect(
    reopened.changes.some(
      (c) =>
        c.author === "Alex Chen · Meridian counsel" && c.insertedText === "30",
    ),
  ).toBe(true);
  expect(
    reopened.changes.filter((c) => c.author === "Northstar · Document agent")
      .length,
  ).toBeGreaterThanOrEqual(3);
});
test("invalid step is atomic and stale prepared plan cannot overwrite a human edit", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const n = window.__negotiation!,
      doc = n.instance.activeEditor!.doc!;
    let s = await n.snapshot(doc, { general: 12, data: 24 });
    await doc.trackChanges.decide(
      {
        decision: "accept",
        target: {
          kind: "ids",
          ids: s.edits
            .find((e) => e.id === "schedule")!
            .existing.map((c) => c.id),
        },
      },
      { expectedRevision: s.revision },
    );
    s = await n.snapshot(doc, { general: 12, data: 24 });
    s.edits.forEach((e) => (e.humanApproved = true));
    const { plan } = await n.preview(doc, s);
    const before = await doc.info({});
    let failed = false;
    try {
      await doc.mutations.apply({
        ...plan,
        steps: [
          ...plan.steps,
          {
            id: "invalid",
            op: "assert",
            where: {
              by: "select",
              select: { type: "text", pattern: "this text does not exist" },
            },
            args: { expectCount: 1 },
          },
        ],
      });
    } catch {
      failed = true;
    }
    const after = await n.snapshot(doc, { general: 12, data: 24 });
    const c = s.edits[0].clause!;
    const match = await doc.query.match({
      select: { type: "text", pattern: c.text },
      within: { kind: "block", nodeType: c.nodeType, nodeId: c.nodeId },
      require: "exactlyOne",
    });
    if (match.items[0].matchKind !== "text") throw new Error("Missing target");
    const human =
      c.text + " The parties will confirm this allocation in writing.";
    await doc.replace(
      { target: match.items[0].target, text: human },
      { changeMode: "direct", expectedRevision: after.revision },
    );
    let stale = "";
    try {
      await n.apply(doc, s, plan);
    } catch (e) {
      stale = (e as Error).message;
    }
    const fresh = await n.snapshot(doc, { general: 12, data: 24 });
    return {
      failed,
      unchanged: before.revision === after.revision,
      original: s.edits.map((e) => e.clause?.text),
      after: after.edits.map((e) => e.clause?.text),
      stale,
      human,
      retained: fresh.edits[0].clause?.text,
    };
  });
  expect(result.failed).toBe(true);
  expect(result.unchanged).toBe(true);
  expect(result.after).toEqual(result.original);
  expect(result.stale).toMatch(/changed/);
  expect(result.retained).toBe(result.human);
});

test("selective rerun preserves accepted work and rejects replacement of edited suggestions", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const n = window.__negotiation!,
      doc = n.instance.activeEditor!.doc!;
    let s = await n.snapshot(doc, { general: 12, data: 24 });
    await doc.trackChanges.decide(
      {
        decision: "accept",
        target: {
          kind: "ids",
          ids: s.edits
            .find((e) => e.id === "schedule")!
            .existing.map((c) => c.id),
        },
      },
      { expectedRevision: s.revision },
    );
    s = await n.snapshot(doc, { general: 12, data: 24 });
    s.edits.forEach((e) => (e.humanApproved = true));
    let p = await n.preview(doc, s);
    const a = await n.apply(doc, s, p.plan);
    const accepted = a.suggestions.find((x) => x.decisionId === "body")!;
    await doc.trackChanges.decide(
      {
        decision: "accept",
        target: { kind: "ids", ids: accepted.verification.changeIds },
      },
      { expectedRevision: (await doc.info({})).revision },
    );
    accepted.status = "accepted";
    await n.clear(doc, a);
    s = await n.snapshot(doc, { general: 12, data: 24 });
    const retained =
      s.edits.find((e) => e.id === "body")!.clause!.text ===
      accepted.proposal.replacement;
    const existing = s.changes.map((c) => ({
      author: c.author,
      text: c.insertedText,
    }));
    const comments = (await doc.info({})).counts.comments;
    s.edits.forEach((e) => (e.humanApproved = true));
    p = await n.preview(doc, s);
    const again = await n.apply(doc, s, p.plan);
    const order = s.edits.find((e) => e.id === "order")!.clause!;
    const m = await doc.query.match({
      select: { type: "text", pattern: "See Section" },
      within: { kind: "block", nodeType: order.nodeType, nodeId: order.nodeId },
      require: "exactlyOne",
    });
    if (m.items[0].matchKind !== "text")
      throw new Error("Missing tracked text");
    const editReceipt = await doc.replace(
      { target: m.items[0].target, text: "Please refer to Section" },
      {
        changeMode: "tracked",
        expectedRevision: (await doc.info({})).revision,
      },
    );
    if (!editReceipt.success) throw new Error(editReceipt.failure?.message);
    const beforeClear = await n.snapshot(doc, { general: 12, data: 24 });
    let guarded = false;
    try {
      await n.clear(doc, again);
    } catch {
      guarded = true;
    }
    return {
      retained,
      existing,
      comments,
      rerunChanges: again.suggestions.length,
      guarded,
      editReceipt,
      editedText: beforeClear.edits.find((e) => e.id === "order")?.clause?.text,
      originalProposal: again.suggestions.find((e) => e.decisionId === "order")
        ?.proposal.replacement,
    };
  });
  expect(result.retained).toBe(true);
  expect(result.existing).toEqual([
    { author: "Alex Chen · Meridian counsel", text: "30" },
  ]);
  expect(result.comments).toBe(3);
  expect(result.rerunChanges).toBe(2);
  expect(result.guarded).toBe(true);
});
test("provider failure preserves the imported document and mobile controls remain usable", async ({
  page,
}) => {
  const before = await page.evaluate(() =>
    window.__negotiation!.snapshot(
      window.__negotiation!.instance.activeEditor!.doc!,
      { general: 12, data: 24 },
    ),
  );
  await page.route("**/api/negotiate", (r) =>
    r.fulfill({
      status: 503,
      json: { error: "Provider unavailable for this test." },
    }),
  );
  await page
    .getByRole("button", { name: "Prepare counterproposal", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Provider unavailable");
  const after = await page.evaluate(() =>
    window.__negotiation!.snapshot(
      window.__negotiation!.instance.activeEditor!.doc!,
      { general: 12, data: 24 },
    ),
  );
  expect(after.revision).toBe(before.revision);
  expect(after.changes).toEqual(before.changes);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Prepare counterproposal", exact: true }),
  ).toBeEnabled();
  const widths = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
  }));
  expect(widths.width).toBeLessThanOrEqual(widths.viewport + 1);
});
