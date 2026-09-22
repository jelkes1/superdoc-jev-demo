import { test, expect } from "@playwright/test";
import type { RuleId } from "../../lib/deal-desk/rules";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Explore freely", exact: true }).click();
  await page.waitForFunction(
    () => !!window.__dealDesk?.instance.activeEditor?.doc,
  );
  await expect(page.getByRole("checkbox")).toBeEnabled();
  await page.waitForFunction(async () => {
    try {
      return (
        (
          await window.__dealDesk!.read(
            window.__dealDesk!.instance.activeEditor!.doc!,
            { training: "consent", notice: 30 },
          )
        ).rows.length === 8
      );
    } catch {
      return false;
    }
  });
});
test("real document operations preserve history; numbered insertion is reviewable; stale and owned edits guarded", async ({
  page,
}, info) => {
  const result = await page.evaluate(async () => {
    const n = window.__dealDesk!,
      doc = n.instance.activeEditor!.doc!,
      p = { training: "consent" as const, notice: 30 as const };
    const decision = (id: RuleId) => ({
      id,
      verdict: "UNACCEPTABLE" as const,
      confidence: 0.99,
      probabilities: {
        ACCEPTABLE: 0.003,
        UNACCEPTABLE: 0.99,
        NEEDS_REVIEW: 0.004,
        NOT_APPLICABLE: 0.003,
      },
      model: "test-only",
    });
    let s = await n.read(doc, p);
    const original = s.changes.map((c) => ({
      id: c.id,
      inserted: c.insertedText,
      deleted: c.deletedText,
    }));
    const operations = [];
    for (const id of [
      "training",
      "training-order",
      "renewal",
      "renewal-order",
    ] as const) {
      const op = await n.apply(doc, s, id, p, decision(id));
      operations.push(op);
      s = await n.read(doc, p);
    }
    const insert = await n.apply(
      doc,
      s,
      "safeguard",
      p,
      decision("safeguard"),
      true,
    );
    s = await n.read(doc, p);
    const afterInsert = s;
    const rejected = await n.decide(doc, insert, "reject");
    s = await n.read(doc, p);
    const insertedAgain = await n.apply(
      doc,
      s,
      "safeguard",
      p,
      decision("safeguard"),
      true,
    );
    const accepted = await n.decide(doc, insertedAgain, "accept");
    s = await n.read(doc, p);
    let duplicate = "";
    try {
      await n.apply(doc, s, "safeguard", p, decision("safeguard"), true);
    } catch (e) {
      duplicate = String(e);
    }
    const target = s.rows.find((r) => r.id === "signals")!.clause!;
    const q = await doc.query.match({
      select: { type: "text", pattern: target.text },
      require: "exactlyOne",
    });
    if (q.items[0].matchKind === "text")
      await doc.replace(
        {
          target: q.items[0].target,
          text: target.text + " Customer approval remains outstanding.",
        },
        { changeMode: "direct", expectedRevision: s.revision },
      );
    let stale = "";
    try {
      await n.apply(doc, s, "training", p, decision("training"));
    } catch (e) {
      stale = String(e);
    }
    return {
      original,
      operations,
      insert,
      afterInsert: afterInsert.rows.find((r) => r.id === "safeguard"),
      rejected: rejected.status,
      accepted: accepted.status,
      duplicate,
      stale,
      after: (await n.read(doc, p)).changes.map((c) => ({
        id: c.id,
        inserted: c.insertedText,
        deleted: c.deletedText,
      })),
    };
  });
  expect(result.operations).toHaveLength(4);
  expect(result.operations.every((o) => o.verified && o.preserved)).toBe(true);
  expect(result.insert.verified).toBe(true);
  expect(result.afterInsert?.present).toBe(true);
  expect(result.rejected).toBe("rejected");
  expect(result.accepted).toBe("accepted");
  expect(result.duplicate).toContain("explicit approval");
  expect(result.stale).toContain("STALE TARGET");
  for (const c of result.original) expect(result.after).toContainEqual(c);
  await info.attach("receipt", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
});
test("review matrix uses actual responses and reuses unchanged decisions", async ({
  page,
}) => {
  const requests: { rows: { id: RuleId }[] }[] = [];
  await page.route("**/api/deal-desk", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await route.fulfill({
      json: {
        revision: body.revision,
        version: body.version,
        reviewId: "test-review",
        decisions: body.rows.map((r: { id: RuleId }) => ({
          id: r.id,
          verdict: ["signals", "liability", "safeguard"].includes(r.id)
            ? "NEEDS_REVIEW"
            : r.id === "payment"
              ? "ACCEPTABLE"
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
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Review the agreement", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Propose 4", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Review matrix", exact: true })
    .click();
  await expect(page.getByRole("table")).toBeVisible();
  await page
    .getByRole("button", { name: "Recheck changed clauses", exact: true })
    .click();
  await expect(
    page.getByText(
      "All available decisions are still current. No model call needed.",
    ),
  ).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole("button", { name: /Cancellation window/ }).click();
  await page.getByText("Try a counter-edit", { exact: true }).click();
  await page
    .getByRole("button", { name: "Edit this clause", exact: true })
    .click();
  const textarea = page.getByRole("textbox", { name: "Counter-edit text" });
  await textarea.fill(
    (await textarea.inputValue()).replace("15 days", "60 days"),
  );
  await page.getByRole("button", { name: "Save into DOCX" }).click();
  await expect(page.getByText(/locations need rechecking/)).toBeVisible();
  await page
    .getByRole("button", { name: "Recheck changed clauses", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].rows.map((r: { id: RuleId }) => r.id)).toEqual([
    "renewal",
  ]);
});

test("modified pending suggestion blocks replacement; accepting one preserves it on policy change", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const n = window.__dealDesk!,
      d = n.instance.activeEditor!.doc!,
      policy = { training: "consent" as const, notice: 30 as const };
    let s = await n.read(d, policy);
    const training = await n.apply(d, s, "training", policy, undefined, true);
    const accepted = await n.decide(d, training, "accept");
    s = await n.read(d, policy);
    const renewal = await n.apply(d, s, "renewal", policy, undefined, true);
    s = await n.read(d, policy);
    // Edit untracked language in the same pending clause using the actual document API.
    const q = await d.query.match({
      select: {
        type: "text",
        pattern: "The subscription automatically renews",
      },
      within: { kind: "block", nodeType: "paragraph", nodeId: renewal.blockId },
      require: "exactlyOne",
    });
    if (q.items[0]?.matchKind !== "text") throw new Error("No live target");
    const edited = await d.replace(
      {
        target: q.items[0].target,
        text: "The enterprise subscription automatically renews",
      },
      { changeMode: "direct", expectedRevision: s.revision },
    );
    if (!edited.success) throw new Error("Counter-edit failed");
    let blocked = "";
    try {
      await n.clear(d, [accepted, renewal]);
    } catch (e) {
      blocked = String(e);
    }
    return { blocked, after: await n.read(d, policy), accepted };
  });
  expect(result.blocked).toContain("pending suggestion");
  expect(result.after.rows.find((r) => r.id === "training")?.clause?.text).toBe(
    result.accepted.after,
  );
  expect(result.after.rows.find((r) => r.id === "renewal")?.problem).toContain(
    "Missing",
  );
  expect(
    result.after.changes.some((c) => result.accepted.changeIds.includes(c.id)),
  ).toBe(false);
});

test("human-approved reasoning text exports and reopens with numbered changes, comments and counsel revisions", async ({
  page,
}, info) => {
  const made = await page.evaluate(async () => {
    const n = window.__dealDesk!,
      doc = n.instance.activeEditor!.doc!;
    const policy = { training: "consent" as const, notice: 30 as const };
    let reading = await n.read(doc, policy);
    const draft =
      reading.rows.find((r) => r.id === "signals")!.clause!.text +
      " The parties must agree in writing on the permitted signals before any model training.";
    const reasoned = await n.apply(
      doc,
      reading,
      "signals",
      policy,
      undefined,
      true,
      draft,
    );
    reading = await n.read(doc, policy);
    const numbered = await n.apply(
      doc,
      reading,
      "safeguard",
      policy,
      undefined,
      true,
    );
    return { reasoned, numbered };
  });
  expect(made.reasoned.verified).toBe(true);
  expect(made.numbered.verified).toBe(true);
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Word", exact: true })
    .click();
  const path = info.outputPath("reasoned-and-numbered.docx");
  await (await download).saveAs(path);
  await page.locator("input[type=file]").setInputFiles(path);
  await expect(
    page.getByRole("button", { name: "Download Word", exact: true }),
  ).toBeEnabled();
  await page.waitForFunction(
    async () =>
      (await window.__dealDesk!.instance.activeEditor!.doc!.info({})).counts
        .comments === 4,
  );
  const result = await page.evaluate(async () => {
    const n = window.__dealDesk!,
      doc = n.instance.activeEditor!.doc!;
    return {
      info: await doc.info({}),
      reading: await n.read(doc, { training: "consent", notice: 30 }),
    };
  });
  expect(result.info.counts.tables).toBe(3);
  expect(result.info.counts.lists).toBeGreaterThan(0);
  expect(result.reading.rows.find((r) => r.id === "safeguard")?.present).toBe(
    true,
  );
  expect(
    result.reading.rows.find((r) => r.id === "signals")?.clause?.text,
  ).toContain("must agree in writing");
  expect(
    result.reading.changes.some(
      (c) =>
        c.author === "Alex Chen · Meridian counsel" && c.insertedText === "30",
    ),
  ).toBe(true);
});
