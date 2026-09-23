import type { BrowserDocumentApi } from "superdoc/ui";
import { extractClauses, listChanges, fingerprint } from "../review/document";
import {
  AGENT_VERSION,
  REGISTRY_VERSION,
  editSchema,
  type Snapshot,
  type Block,
  type Edit,
  type Execution,
} from "./types";
export async function hashText(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function documentIndex(
  doc: BrowserDocumentApi,
  request: string,
  documentHash: string,
): Promise<Snapshot> {
  const extracted = await extractClauses(doc),
    outline = await doc.blocks.list({ includeText: true, limit: 1000 }),
    revisions = await listChanges(doc);
  if (extracted.warnings.length)
    throw new Error(`Incomplete document extraction: ${extracted.warnings[0]}`);
  const tables = new Map<string, string>();
  for (const b of outline.blocks.filter((b) => b.nodeType === "table")) {
    const cells = await doc.query.match({
      select: { type: "node", nodeType: "paragraph" },
      within: { kind: "block", nodeType: "table", nodeId: b.nodeId },
      require: "any",
      limit: 1000,
    });
    for (const c of cells.items)
      if (c.matchKind === "node" && c.address.kind === "block")
        tables.set(c.address.nodeId, b.nodeId);
  }
  const blocks: Block[] = extracted.clauses.map((c, i) => ({
    id: `b${i}`,
    nodeId: c.nodeId,
    nodeType: c.nodeType,
    text: c.text,
    title: c.title,
    section: c.context.match(/^Section: ([^\n]*)/)?.[1] ?? c.title,
    ordinal: i,
    table: tables.get(c.nodeId) ?? null,
    dependencies: [],
    unresolvedRefs: [],
    existingRevisions: revisions
      .filter((r) => r.navigationTarget?.blockId === c.nodeId)
      .map((r) => r.id),
  }));
  const definitions = blocks.filter((b) => /definition/i.test(b.title));
  for (const b of blocks) {
    const deps = new Set<string>();
    blocks
      .filter(
        (n) =>
          (n.title === b.title && Math.abs(n.ordinal - b.ordinal) <= 1) ||
          (b.table && b.table === n.table),
      )
      .forEach((n) => deps.add(n.id));
    // Definitions are deliberately conservative; never infer entity identity from string matches alone.
    definitions.forEach((n) => deps.add(n.id));
    for (const m of b.text.matchAll(
      /\b(Section|Schedule)\s+([A-Z](?![a-z])|\d+(?:\.\d+)*)/g,
    )) {
      const label = m[2];
      const target = blocks.filter((n) =>
        m[1] === "Schedule"
          ? new RegExp(`Schedule\\s+${label}\\b`).test(
              n.section + " " + n.title,
            )
          : new RegExp(
              `^(?:Section\\s+)?${label.replaceAll(".", "\\.")}(?:\\s|$)`,
            ).test(n.title) ||
            (m[1] === "Section" &&
              new RegExp(
                `^(?:Section\\s+)?${label.replaceAll(".", "\\.")}(?:\\s|$)`,
              ).test(n.section)),
      );
      if (target.length) target.forEach((n) => deps.add(n.id));
      else b.unresolvedRefs.push(m[0]);
    }
    deps.delete(b.id);
    b.dependencies = [...deps];
  }
  if ((await doc.info({})).revision !== extracted.revision)
    throw new Error("The document changed during extraction. Recheck it.");
  return {
    version: AGENT_VERSION,
    registryVersion: REGISTRY_VERSION,
    documentHash,
    revision: extracted.revision,
    blocks,
    request,
    warnings: [
      "Coverage: body text, lists and table cells. Headers, footers, text boxes, images and external documents are outside this example.",
    ],
  };
}
export async function blockText(doc: BrowserDocumentApi, b: Block) {
  const r = await doc.query.match({
    select: { type: "text", pattern: "[^\\n]+", mode: "regex" },
    within: { kind: "block", nodeId: b.nodeId, nodeType: b.nodeType },
    require: "any",
    limit: 1000,
  });
  return r.items
    .flatMap((x) => (x.matchKind === "text" ? x.blocks.map((b) => b.text) : []))
    .join("\n")
    .trim();
}
export async function executeEdit(
  doc: BrowserDocumentApi,
  snapshot: Snapshot,
  edit: Edit,
  expectedRevision: string,
): Promise<Execution> {
  edit = editSchema.parse(edit);
  if ((await doc.info({})).revision !== expectedRevision)
    throw new Error(
      "The document changed after approval. Recheck before applying.",
    );
  const b = snapshot.blocks.find((b) => b.id === edit.blockId);
  if (!b) throw new Error("Unknown document target.");
  const caps = await doc.capabilities();
  const c =
    caps.operations[edit.tool === "replace" ? "replace" : "comments.create"];
  if (!c?.available || (edit.tool === "replace" && !c.tracked))
    throw new Error("This document operation is unavailable.");
  const before = await listChanges(doc),
    details = await Promise.all(
      before.map((c) => doc.trackChanges.get({ id: c.id })),
    );
  if (before.some((c) => c.navigationTarget?.blockId === b.nodeId))
    throw new Error(
      "This block contains a revision. Resolve it before changing the block.",
    );
  const match = await doc.query.match({
    select: { type: "text", pattern: edit.original, caseSensitive: true },
    within: { kind: "block", nodeId: b.nodeId, nodeType: b.nodeType },
    require: "exactlyOne",
  });
  if (match.total !== 1 || match.items[0]?.matchKind !== "text")
    throw new Error("The exact source span no longer matches uniquely.");
  const textBefore = await blockText(doc, b);
  let receipt: unknown,
    commentId: string | undefined,
    commentVerified = false;
  if (edit.tool === "replace") {
    const r = await doc.replace(
      { target: match.items[0].target, text: edit.replacement },
      { changeMode: "tracked", expectedRevision },
    );
    receipt = r;
    if (!r.success)
      throw new Error(r.failure?.message ?? "Tracked replacement failed.");
  } else {
    const r = await doc.comments.create(
      {
        target: match.items[0].target,
        text: edit.replacement,
        author: "SuperDoc document agent",
        authorEmail: "agent@example.invalid",
      },
      { expectedRevision },
    );
    receipt = r;
    if (!r.success || !r.id) throw new Error("Comment creation failed.");
    commentId = r.id;
    const saved = await doc.comments.get({ commentId });
    commentVerified =
      saved.text === edit.replacement && saved.anchoredText === edit.original;
  }
  const after = await listChanges(doc),
    afterDetails = await Promise.all(
      after.map((c) => doc.trackChanges.get({ id: c.id })),
    ),
    owned = afterDetails.filter((c) => !before.some((b) => b.id === c.id));
  const preserved = details.every((b) =>
    afterDetails.some(
      (a) => a.id === b.id && fingerprint(a) === fingerprint(b),
    ),
  );
  const textAfter = await blockText(doc, b),
    expected =
      edit.tool === "replace"
        ? textBefore.replace(edit.original, edit.replacement)
        : textBefore;
  const tracked =
    owned.length > 0 &&
    owned.every((c) => c.navigationTarget?.blockId === b.nodeId);
  return {
    edit,
    changeIds: owned.map((c) => c.id),
    fingerprints: Object.fromEntries(owned.map((c) => [c.id, fingerprint(c)])),
    commentId,
    beforeRevision: expectedRevision,
    afterRevision: (await doc.info({})).revision,
    verified:
      preserved &&
      textAfter === expected &&
      (edit.tool === "replace" ? tracked : commentVerified),
    preserved,
    commentVerified,
    receipt,
    status: "pending",
  };
}
export async function guardExecution(
  doc: BrowserDocumentApi,
  s: Snapshot,
  e: Execution,
) {
  const b = s.blocks.find((b) => b.id === e.edit.blockId);
  if (!b) throw new Error("Missing original target.");
  const changes = await listChanges(doc);
  for (const id of e.changeIds) {
    if (
      !changes.some((c) => c.id === id) ||
      fingerprint(await doc.trackChanges.get({ id })) !== e.fingerprints[id]
    )
      throw new Error(
        "A pending suggestion was edited or resolved. Review it manually; your work is preserved.",
      );
  }
  if (e.edit.tool === "replace") {
    const expected = b.text.replace(e.edit.original, e.edit.replacement);
    if (
      (await blockText(doc, b)) !== expected ||
      changes.some(
        (c) =>
          c.navigationTarget?.blockId === b.nodeId &&
          !e.changeIds.includes(c.id),
      )
    )
      throw new Error(
        "A pending suggestion was modified. Resolve it manually before rechecking.",
      );
  }
  if (e.commentId) {
    const c = await doc.comments.get({ commentId: e.commentId });
    if (c.text !== e.edit.replacement || c.anchoredText !== e.edit.original)
      throw new Error("The pending comment was edited. Resolve it manually.");
  }
}
export async function decideEdit(
  doc: BrowserDocumentApi,
  s: Snapshot,
  e: Execution,
  decision: "accept" | "reject",
): Promise<Execution> {
  await guardExecution(doc, s, e);
  if (e.changeIds.length) {
    const r = await doc.trackChanges.decide(
      { decision, target: { kind: "ids", ids: e.changeIds } },
      { expectedRevision: (await doc.info({})).revision },
    );
    if (!r.success) throw new Error("The review action failed.");
  }
  if (e.commentId && decision === "reject") {
    const r = await doc.comments.delete(
      { commentId: e.commentId },
      { expectedRevision: (await doc.info({})).revision },
    );
    if (!r.success) throw new Error("The comment could not be removed.");
  }
  return { ...e, status: decision === "accept" ? "accepted" : "rejected" };
}
