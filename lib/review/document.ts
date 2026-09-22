import type { BrowserDocumentApi, TrackChangeInfo } from "superdoc/ui";
import type { Clause, Proposal, Suggestion, Verification } from "./types";
import { getEncoding } from "js-tiktoken";
const encoder = getEncoding("o200k_base");
export const tokenCount = (text: string) => encoder.encode(text).length;
export async function extractClauses(doc: BrowserDocumentApi): Promise<{
  clauses: Clause[];
  revision: string;
  tokens: number;
  warnings: string[];
}> {
  // blocks.list includes headings and tables in document order. query.match defaults
  // to paragraph nodes in this package version, so it is not our document outline.
  const result = await doc.blocks.list({ includeText: true, limit: 1000 });
  if (result.total > 1000)
    throw new Error(
      "This document has more than 1,000 blocks. Try a smaller contract.",
    );
  const paragraphs: Clause[] = [];
  let section = "Agreement",
    title = "Agreement";
  const warnings: string[] = [];
  const tableContexts = new Map<string, string>();
  async function add(
    nodeId: string,
    nodeType: Clause["nodeType"],
    tableContext?: string,
  ) {
    const visible = await doc.query.match({
      select: { type: "text", pattern: "[^\\n]+", mode: "regex" },
      within: { kind: "block", nodeId, nodeType },
      require: "any",
      limit: 1000,
    });
    if (visible.total > 1000)
      throw new Error(
        "A block contains too many text fragments for this demo.",
      );
    const text = visible.items
      .flatMap((i) =>
        i.matchKind === "text" ? i.blocks.map((b) => b.text) : [],
      )
      .join("\n")
      .trim();
    if (!text) return;
    paragraphs.push({
      id: nodeId,
      title,
      text,
      context: section,
      nodeId,
      nodeType,
      ordinal: paragraphs.length,
      incomplete: text.length > 6000,
    });
    if (tableContext) tableContexts.set(nodeId, tableContext);
  }
  for (const block of result.blocks) {
    if (block.nodeType === "heading") {
      title = block.text ?? block.textPreview ?? "Heading";
      if (block.headingLevel === 1) section = title;
      continue;
    }
    if (block.nodeType === "table") {
      const cells = await doc.query.match({
        select: { type: "node", nodeType: "paragraph" },
        within: { kind: "block", nodeType: "table", nodeId: block.nodeId },
        require: "any",
        limit: 1000,
      });
      if (cells.total > 1000)
        throw new Error("This table is too large to review safely.");
      const context = `Table in ${title}: ${block.text ?? ""}`;
      for (const cell of cells.items)
        if (cell.matchKind === "node" && cell.address.kind === "block")
          await add(cell.address.nodeId, "paragraph", context);
    } else if (block.nodeType === "paragraph" || block.nodeType === "listItem")
      await add(block.nodeId, block.nodeType);
    else
      warnings.push(
        `Unsupported ${block.nodeType} content remains outside automatic review.`,
      );
  }
  const tokens = tokenCount(paragraphs.map((c) => c.text).join("\n"));
  if (tokens > 25000)
    throw new Error(
      `This document contains approximately ${tokens.toLocaleString()} tokens. The demo limit is 25,000.`,
    );
  if (paragraphs.length === 0)
    throw new Error(
      "No readable body text was found. Use a text-based DOCX in English.",
    );
  const text = paragraphs.map((c) => c.text).join(" ");
  if (!/\b(the|and|agreement|shall|services|customer|provider)\b/i.test(text))
    throw new Error(
      "This demo supports English contracts. No English contract text was detected.",
    );
  // Include nearby paragraphs and section context, retaining IDs for exact edits.
  const sections = paragraphs.map((c) => c.context);
  for (let i = 0; i < paragraphs.length; i++) {
    const c = paragraphs[i];
    const neighbors = paragraphs
      .filter(
        (n, j) => sections[j] === sections[i] && Math.abs(n.ordinal - i) <= 2,
      )
      .map((n) => `${n.title}: ${n.text}`)
      .join("\n");
    c.context = `Section: ${c.context}\n${tableContexts.get(c.id) ?? ""}\n${neighbors}`;
    if (c.text.length > 6000 || c.context.length > 12000) {
      c.incomplete = true;
      warnings.push(
        `${c.title}: context exceeds the demo’s per-clause allowance; human review required.`,
      );
    }
  }
  if ((await doc.info({})).revision !== result.revision)
    throw new Error("The document changed during extraction. Please retry.");
  return { clauses: paragraphs, revision: result.revision, tokens, warnings };
}
export async function listChanges(doc: BrowserDocumentApi) {
  const all = await doc.trackChanges.list({ limit: 1000, in: "all" });
  if (all.total > 1000)
    throw new Error(
      "Too many existing revisions for this demo to verify safely.",
    );
  return all.items;
}
export function fingerprint(c: unknown) {
  const x = c as TrackChangeInfo & { before?: unknown; after?: unknown };
  return JSON.stringify([
    x.id,
    x.type,
    x.insertedText,
    x.deletedText,
    x.before,
    x.after,
    x.target,
    x.overlap,
  ]);
}
export async function applyTrackedReplacement(
  doc: BrowserDocumentApi,
  clause: Clause,
  proposal: Proposal,
  decisionId: string,
  expectedRevision?: string,
): Promise<Suggestion> {
  if (
    clause.incomplete ||
    !proposal.original ||
    !proposal.replacement ||
    proposal.original === proposal.replacement
  )
    throw new Error("This proposal cannot be safely applied.");
  const capabilities = await doc.capabilities();
  if (
    !capabilities.operations.replace?.available ||
    !capabilities.operations.replace?.tracked
  )
    throw new Error("Tracked replacement is unavailable for this document.");
  const before = await listChanges(doc);
  const existingDetails = await Promise.all(
    before.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  if (
    existingDetails.some((c) =>
      JSON.stringify([c.target, c.navigationTarget]).includes(clause.nodeId),
    )
  )
    throw new Error(
      "This clause already contains a tracked change. Resolve it before proposing another edit.",
    );
  const beforeRevision = (await doc.info({})).revision;
  const matches = await doc.query.match({
    select: { type: "text", pattern: proposal.original, caseSensitive: true },
    within: { kind: "block", nodeType: clause.nodeType, nodeId: clause.nodeId },
    require: "exactlyOne",
  });
  if (matches.total !== 1 || matches.items[0]?.matchKind !== "text")
    throw new Error(
      "The original clause is no longer a unique match. Run the review again.",
    );
  if ((await doc.info({})).revision !== beforeRevision)
    throw new Error("The document changed while resolving this target.");
  if (expectedRevision && beforeRevision !== expectedRevision)
    throw new Error(
      "The document changed after review. Rerun before applying this proposal.",
    );
  const match = matches.items[0];
  const receipt = await doc.replace(
    { target: match.target, text: proposal.replacement },
    { changeMode: "tracked", expectedRevision: beforeRevision },
  );
  if (!receipt.success)
    throw new Error(
      receipt.failure?.message ?? "SuperDoc did not apply the replacement.",
    );
  const after = await listChanges(doc);
  const oldIds = new Set(before.map((c) => c.id));
  const added = after.filter((c) => !oldIds.has(c.id));
  const details = await Promise.all(
    added.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  const readback = await doc.query.match({
    select: {
      type: "text",
      pattern: proposal.replacement,
      caseSensitive: true,
    },
    within: { kind: "block", nodeType: clause.nodeType, nodeId: clause.nodeId },
    require: "any",
  });
  // Read the same block in its original review view. This verifies the complete
  // old text even when SuperDoc emits a minimal word-level tracked replacement.
  const original = await doc.projectHtml({
    scope: { kind: "block", nodeType: clause.nodeType, nodeId: clause.nodeId },
    reviewMode: "original",
  });
  const originalText = new DOMParser()
    .parseFromString(original.content, "text/html")
    .body.textContent?.trim();
  const receiptIds = new Set(
    (receipt.inserted ?? [])
      .filter((r) => r.kind === "entity" && r.entityType === "trackedChange")
      .map((r) => r.entityId),
  );
  const trackedVerified =
    details.length > 0 &&
    original.status !== "failed" &&
    originalText === proposal.original &&
    details.every(
      (c) =>
        receiptIds.has(c.id) && c.navigationTarget?.blockId === clause.nodeId,
    );
  const v: Verification = {
    applied: true,
    textVerified: readback.total === 1,
    trackedVerified,
    changeIds: added.map((c) => c.id),
    beforeRevision,
    afterRevision: (await doc.info({})).revision,
    receipt,
  };
  const fingerprints = Object.fromEntries(
    details.map((c) => [c.id, fingerprint(c)]),
  );
  // Keep the receipt and IDs even if verification fails; never claim an unverified mutation is harmless.
  return {
    decisionId,
    clauseId: clause.id,
    proposal,
    verification: v,
    fingerprints,
    status: v.textVerified && v.trackedVerified ? "pending" : "changed",
  };
}
export async function validatePending(
  doc: BrowserDocumentApi,
  suggestions: Suggestion[],
) {
  const current = await listChanges(doc);
  const ids = new Set(current.map((c) => c.id));
  for (const s of suggestions.filter(
    (s) => s.status === "pending" || s.status === "changed",
  )) {
    const remaining = s.verification.changeIds.filter((id) => ids.has(id));
    if (!remaining.length) {
      if (current.some((c) => c.navigationTarget?.blockId === s.clauseId))
        throw new Error(
          "A pending suggestion changed identity. Resolve the clause’s redlines before rerunning.",
        );
      continue;
    }
    if (s.status === "changed")
      throw new Error(
        "A proposal could not be verified. Review its tracked changes before starting a new run.",
      );
    if (remaining.length !== s.verification.changeIds.length)
      throw new Error(
        "Part of a suggestion changed. Resolve its remaining redlines before rerunning.",
      );
    for (const id of remaining) {
      const detail = await doc.trackChanges.get({ id });
      if (fingerprint(detail) !== s.fingerprints[id])
        throw new Error(
          "You edited a pending suggestion. Accept or reject it before rerunning.",
        );
    }
  }
  return ids;
}
export async function clearPending(
  doc: BrowserDocumentApi,
  suggestions: Suggestion[],
) {
  const ids = await validatePending(doc, suggestions);
  const reject = suggestions
    .filter((s) => s.status === "pending")
    .flatMap((s) => s.verification.changeIds.filter((id) => ids.has(id)));
  if (!reject.length) return;
  const current = await doc.info({});
  const receipt = await doc.trackChanges.decide(
    { decision: "reject", target: { kind: "ids", ids: reject } },
    { expectedRevision: current.revision },
  );
  if (!receipt.success)
    throw new Error(
      "Could not clear this review’s pending suggestions. Resolve them in the editor.",
    );
  const remaining = await listChanges(doc);
  if (remaining.some((c) => reject.includes(c.id)))
    throw new Error(
      "Some pending changes remain. Resolve them before rerunning.",
    );
}
