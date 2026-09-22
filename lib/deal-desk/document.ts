import type { BrowserDocumentApi } from "superdoc/ui";
import { extractClauses, listChanges, fingerprint } from "../review/document";
import type { Clause } from "../review/types";
import {
  RULES,
  proposedText,
  requirement,
  type Policy,
  type RuleId,
  type Decision,
} from "./rules";
export interface Row {
  id: RuleId;
  clause?: Clause;
  context: string;
  replacement: string | null;
  existing: string[];
  problem?: string;
  present?: boolean;
}
export interface Reading {
  revision: string;
  rows: Row[];
  changes: Awaited<ReturnType<typeof listChanges>>;
  comments: number;
  tokens: number;
}
export interface Operation {
  id: RuleId;
  blockId: string;
  before: string;
  after: string;
  changeIds: string[];
  fingerprints: Record<string, string>;
  commentId?: string;
  receipt: unknown;
  beforeRevision: string;
  afterRevision: string;
  verified: boolean;
  preserved: boolean;
  kind: "replace" | "insert";
  status: "pending" | "accepted" | "rejected";
  warning?: string;
}
export async function readDocument(
  doc: BrowserDocumentApi,
  policy: Policy,
): Promise<Reading> {
  const start = (await doc.info({})).revision;
  const extracted = await extractClauses(doc);
  const changes = await listChanges(doc);
  const rows = RULES.map((r) => {
    const candidates = extracted.clauses.filter(
      (c) =>
        c.text.startsWith(r.prefix) ||
        ("alignedPrefix" in r && c.text.startsWith(r.alignedPrefix)),
    );
    // Match the value cell, not the order-form label.
    const matches =
      r.id === "training-order"
        ? candidates.filter((c) => c.text !== "Model training")
        : candidates;
    const clause = matches.length === 1 ? matches[0] : undefined;
    const inserted =
      r.id === "safeguard"
        ? extracted.clauses.filter((c) =>
            c.text.startsWith(
              "Customer Data, including de-identified excerpts, must not",
            ),
          )
        : [];
    const actual = inserted.length === 1 ? inserted[0] : clause;
    const context =
      r.id === "safeguard"
        ? extracted.clauses
            .filter((c) => c.title.includes("Schedule C"))
            .map((c) => c.text)
            .join("\n")
        : (clause?.context ?? "");
    return {
      id: r.id,
      clause: actual,
      context,
      replacement: clause ? proposedText(r, clause.text, policy) : null,
      existing: changes
        .filter((c) => c.navigationTarget?.blockId === actual?.nodeId)
        .map((c) => c.id),
      present: inserted.length > 0,
      problem:
        matches.length !== 1
          ? "Missing or duplicate location. Inspect manually."
          : inserted.length > 1
            ? "Duplicate safeguards require human review."
            : actual?.incomplete
              ? "Incomplete context. Inspect manually."
              : undefined,
    };
  });
  const info = await doc.info({});
  if (info.revision !== start)
    throw new Error("The document changed while reading. Try again.");
  return {
    revision: start,
    rows,
    changes,
    comments: info.counts.comments,
    tokens: extracted.tokens,
  };
}
export function signature(row: Row, policy: Policy) {
  return JSON.stringify([
    row.clause?.id,
    row.clause?.text,
    row.context,
    row.existing,
    policy,
  ]);
}
export function eligible(row: Row, decision?: Decision) {
  return (
    !row.problem &&
    !!row.clause &&
    !!row.replacement &&
    row.clause.text !== row.replacement &&
    !row.existing.length &&
    RULES.find((r) => r.id === row.id)?.kind === "replace" &&
    decision?.verdict === "UNACCEPTABLE" &&
    decision.confidence >= 0.95
  );
}
export async function applyOperation(
  doc: BrowserDocumentApi,
  reading: Reading,
  id: RuleId,
  policy: Policy,
  decision: Decision | undefined,
  humanApproved = false,
  draftText?: string,
): Promise<Operation> {
  const sourceRow = reading.rows.find((r) => r.id === id)!;
  const originalRule = RULES.find((r) => r.id === id)!;
  if (
    draftText &&
    (id !== "signals" || !humanApproved || draftText.length > 9000)
  )
    throw new Error("Reasoned text requires explicit human approval.");
  const row = draftText ? { ...sourceRow, replacement: draftText } : sourceRow;
  const rule = draftText
    ? { ...originalRule, kind: "replace" as const }
    : originalRule;
  if ((await doc.info({})).revision !== reading.revision)
    throw new Error(
      "STALE TARGET: the document changed. Recheck before applying; your edit is preserved.",
    );
  if (row.problem || !row.clause || !row.replacement || row.existing.length)
    throw new Error(
      "This location cannot be changed safely. Resolve its existing revisions first.",
    );
  if (rule.kind !== "insert" && !eligible(row, decision) && !humanApproved)
    throw new Error("This proposal needs human approval.");
  if (
    rule.kind === "insert" &&
    (!humanApproved || row.present || row.clause.nodeType !== "listItem")
  )
    throw new Error(
      "A missing clause needs explicit approval and a unique numbered insertion point.",
    );
  if (!["replace", "insert"].includes(rule.kind))
    throw new Error("This finding remains a human decision.");
  const caps = await doc.capabilities();
  const cap =
    caps.operations[rule.kind === "insert" ? "lists.insert" : "replace"];
  if (!cap?.available || !cap.tracked)
    throw new Error("Tracked execution is not supported for this operation.");
  const before = await listChanges(doc);
  const details = await Promise.all(
    before.map((c) => doc.trackChanges.get({ id: c.id })),
  );
  let receipt: unknown;
  let blockId = row.clause.nodeId;
  if (rule.kind === "insert") {
    const r = await doc.lists.insert(
      {
        target: { kind: "block", nodeType: "listItem", nodeId: blockId },
        position: "after",
        text: row.replacement,
      },
      { changeMode: "tracked", expectedRevision: reading.revision },
    );
    receipt = r;
    if (!r.success) throw new Error(r.failure.message);
    blockId = r.item.nodeId;
  } else {
    const match = await doc.query.match({
      select: { type: "text", pattern: row.clause.text, caseSensitive: true },
      within: { kind: "block", nodeId: blockId, nodeType: row.clause.nodeType },
      require: "exactlyOne",
    });
    if (match.total !== 1 || match.items[0]?.matchKind !== "text")
      throw new Error("The target no longer matches uniquely.");
    const r = await doc.replace(
      { target: match.items[0].target, text: row.replacement },
      { changeMode: "tracked", expectedRevision: reading.revision },
    );
    receipt = r;
    if (!r.success)
      throw new Error(r.failure?.message ?? "Replacement failed.");
  }
  const after = await listChanges(doc);
  const created = after.filter((c) => !before.some((b) => b.id === c.id));
  const afterDetails = await Promise.all(
    after.map((c) => doc.trackChanges.get({ id: c.id })),
  );
  const preserved = details.every((b) =>
    afterDetails.some(
      (a) => a.id === b.id && fingerprint(a) === fingerprint(b),
    ),
  );
  const readback = await doc.query.match({
    select: { type: "text", pattern: row.replacement, caseSensitive: true },
    within: {
      kind: "block",
      nodeType: rule.kind === "insert" ? "listItem" : row.clause.nodeType,
      nodeId: blockId,
    },
    require: "any",
  });
  const own = afterDetails.filter((c) => created.some((x) => x.id === c.id));
  const receiptRefs =
    rule.kind === "insert"
      ? (receipt as { trackedChangeRefs?: { entityId: string }[] })
          .trackedChangeRefs
      : (receipt as { inserted?: { entityId?: string }[] }).inserted;
  const receiptHasRevisions = !!receiptRefs?.length;
  const verified =
    receiptHasRevisions &&
    preserved &&
    readback.total === 1 &&
    own.length > 0 &&
    own.every((c) => c.navigationTarget?.blockId === blockId);
  let commentId: string | undefined, warning: string | undefined;
  if (verified)
    try {
      const c = await doc.comments.create(
        {
          text: `Agreed terms · ${rule.label}: ${requirement(originalRule, policy)} Proposed by the document agent for human review.`,
          target:
            rule.kind === "insert"
              ? {
                  kind: "text",
                  blockId: row.clause.nodeId,
                  range: { start: 0, end: row.clause.text.length },
                }
              : {
                  kind: "trackedChange",
                  trackedChangeId: own[0].id,
                  side: "inserted",
                },
          author: "Northstar · Document agent",
          authorEmail: "agent@example.invalid",
        },
        { expectedRevision: (await doc.info({})).revision },
      );
      if (!c.success || !c.id) throw new Error();
      const saved = await doc.comments.get({ commentId: c.id });
      if (!saved.text?.startsWith("Agreed terms")) throw new Error();
      commentId = c.id;
    } catch {
      warning =
        "The edit is verified; its explanation comment could not be verified.";
    }
  return {
    id,
    kind: rule.kind as "insert" | "replace",
    blockId,
    before: rule.kind === "insert" ? "" : row.clause.text,
    after: row.replacement,
    changeIds: own.map((c) => c.id),
    fingerprints: Object.fromEntries(own.map((c) => [c.id, fingerprint(c)])),
    commentId,
    receipt,
    beforeRevision: reading.revision,
    afterRevision: (await doc.info({})).revision,
    verified,
    preserved,
    status: "pending",
    warning,
  };
}
export async function guardOwned(doc: BrowserDocumentApi, op: Operation) {
  const current = await listChanges(doc);
  const remaining = current.filter((c) => op.changeIds.includes(c.id));
  if (remaining.length !== op.changeIds.length)
    throw new Error(
      "This proposal was changed or partially resolved in the editor. Inspect its remaining redlines manually.",
    );
  for (const c of remaining) {
    if (
      fingerprint(await doc.trackChanges.get({ id: c.id })) !==
      op.fingerprints[c.id]
    )
      throw new Error(
        "You edited a pending suggestion. Resolve it manually; your work is preserved.",
      );
  }
  const read = await doc.query.match({
    select: { type: "text", pattern: "[^\\n]+", mode: "regex" },
    within: {
      kind: "block",
      nodeId: op.blockId,
      nodeType: op.kind === "insert" ? "listItem" : "paragraph",
    },
    require: "any",
  });
  const text = read.items
    .flatMap((x) => (x.matchKind === "text" ? x.blocks.map((b) => b.text) : []))
    .join("\n")
    .trim();
  if (
    text !== op.after ||
    current.some(
      (c) =>
        c.navigationTarget?.blockId === op.blockId &&
        !op.changeIds.includes(c.id),
    )
  )
    throw new Error(
      "You edited a clause with a pending suggestion. Resolve its redlines before replacing it. Your work is preserved.",
    );
}
export async function decideOperation(
  doc: BrowserDocumentApi,
  op: Operation,
  decision: "accept" | "reject",
) {
  await guardOwned(doc, op);
  const r = await doc.trackChanges.decide(
    { decision, target: { kind: "ids", ids: op.changeIds } },
    { expectedRevision: (await doc.info({})).revision },
  );
  if (!r.success) throw new Error(r.failure?.message ?? "Review failed.");
  return {
    ...op,
    status:
      decision === "accept" ? ("accepted" as const) : ("rejected" as const),
  };
}
export async function clearOwned(
  doc: BrowserDocumentApi,
  ops: Operation[],
  onResolved?: (op: Operation) => void,
) {
  const pending = ops.filter((x) => x.status === "pending");
  for (const op of pending) await guardOwned(doc, op);
  for (const op of pending) {
    const resolved = await decideOperation(doc, op, "reject");
    onResolved?.(resolved);
    if (op.commentId) {
      // Rejecting a tracked insertion can remove its anchored comment too.
      // Only delete a comment that still exists after resolving the revision.
      const existing = await doc.comments.list({ limit: 1000 });
      if (!existing.items.some((comment) => comment.id === op.commentId))
        continue;
      const c = await doc.comments.delete(
        { commentId: op.commentId },
        { expectedRevision: (await doc.info({})).revision },
      );
      if (!c.success)
        throw new Error("Could not remove an earlier explanation comment.");
    }
  }
}
