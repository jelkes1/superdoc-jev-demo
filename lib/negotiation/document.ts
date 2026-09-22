import type { BrowserDocumentApi } from "superdoc/ui";
type TrackChangeInfo = Awaited<
  ReturnType<BrowserDocumentApi["trackChanges"]["get"]>
>;
import {
  extractClauses,
  listChanges,
  fingerprint,
  validatePending,
  clearPending,
} from "../review/document";
import type { Clause, Suggestion } from "../review/types";
import {
  findLocations,
  replacement,
  type DealPolicy,
  type DealDecision,
  type LocationId,
} from "./scenario";

export interface ConnectedEdit {
  id: LocationId;
  label: string;
  reference: string;
  clause?: Clause;
  replacement: string | null;
  existing: TrackChangeInfo[];
  decision?: DealDecision;
  problem?: string;
  humanApproved?: boolean;
}
export interface Snapshot {
  revision: string;
  edits: ConnectedEdit[];
  changes: TrackChangeInfo[];
  comments: number;
}
export type TrackedPlan = Parameters<
  BrowserDocumentApi["mutations"]["apply"]
>[0];
export interface AppliedDeal {
  suggestions: Suggestion[];
  comments: { clauseId: string; id: string }[];
  receipt: unknown;
  preserved: boolean;
  verified: boolean;
  warnings: string[];
}
export async function snapshot(
  doc: BrowserDocumentApi,
  policy: DealPolicy,
): Promise<Snapshot> {
  const start = (await doc.info({})).revision;
  const extracted = await extractClauses(doc);
  const changes = await listChanges(doc);
  const details = await Promise.all(
    changes.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  const info = await doc.info({});
  if (info.revision !== start)
    throw new Error(
      "The document changed while it was being read. Prepare the proposal again.",
    );
  return {
    revision: info.revision,
    changes: details,
    comments: info.counts.comments,
    edits: findLocations(extracted.clauses).map((l) => ({
      id: l.id,
      label: l.label,
      reference: l.reference,
      clause: l.clause,
      problem: l.problem,
      replacement: l.clause ? replacement(l.id, l.clause.text, policy) : null,
      existing: l.clause
        ? details.filter((c) =>
            JSON.stringify([c.target, c.navigationTarget]).includes(
              l.clause!.nodeId,
            ),
          )
        : [],
    })),
  };
}
export function canPropose(e: ConnectedEdit) {
  return (
    !!e.clause &&
    !e.clause.incomplete &&
    !!e.replacement &&
    e.replacement !== e.clause.text &&
    !e.existing.length &&
    !e.problem &&
    (e.humanApproved ||
      (e.decision?.verdict === "UNACCEPTABLE" && e.decision.confidence >= 0.95))
  );
}
export function isAligned(e: ConnectedEdit) {
  return (
    !!e.clause &&
    !e.clause.incomplete &&
    !!e.replacement &&
    e.replacement === e.clause.text &&
    !e.existing.length &&
    !e.problem &&
    (e.humanApproved ||
      (e.decision?.verdict === "ACCEPTABLE" && e.decision.confidence >= 0.95))
  );
}
export async function staleLocations(
  doc: BrowserDocumentApi,
  source: Snapshot,
  policy: DealPolicy,
) {
  const fresh = await snapshot(doc, policy);
  const changed = source.edits
    .filter((e) => {
      const now = fresh.edits.find((x) => x.id === e.id);
      return (
        now?.clause?.id !== e.clause?.id ||
        now?.clause?.text !== e.clause?.text ||
        JSON.stringify(now?.existing.map(fingerprint)) !==
          JSON.stringify(e.existing.map(fingerprint))
      );
    })
    .map((e) => e.id);
  return { fresh, changed, stale: fresh.revision !== source.revision };
}
export async function buildPlan(
  doc: BrowserDocumentApi,
  source: Snapshot,
): Promise<TrackedPlan> {
  if ((await doc.info({})).revision !== source.revision)
    throw new Error(
      "The document changed after this proposal was prepared. Review the current text before applying.",
    );
  const eligible = source.edits.filter(canPropose);
  if (!eligible.length)
    throw new Error("No eligible changes are ready to propose.");
  if (
    source.edits.some(
      (e) =>
        e.existing.length ||
        e.problem ||
        !e.replacement ||
        (!canPropose(e) && !isAligned(e)),
    )
  )
    throw new Error(
      "Resolve the open locations before applying this connected proposal.",
    );
  const caps = await doc.capabilities();
  if (
    !caps.operations["mutations.apply"]?.available ||
    !caps.operations.replace?.tracked
  )
    throw new Error(
      "Tracked mutation plans are unavailable for this document.",
    );
  const steps: TrackedPlan["steps"] = [];
  for (const edit of eligible) {
    const clause = edit.clause!;
    const match = await doc.query.match({
      select: { type: "text", pattern: clause.text, caseSensitive: true },
      within: {
        kind: "block",
        nodeType: clause.nodeType,
        nodeId: clause.nodeId,
      },
      require: "exactlyOne",
    });
    if (match.total !== 1 || match.items[0]?.matchKind !== "text")
      throw new Error(`The target in ${edit.label} is no longer unique.`);
    steps.push({
      id: edit.id,
      op: "text.rewrite",
      where: {
        by: "select",
        select: { type: "text", pattern: clause.text, caseSensitive: true },
        within: {
          kind: "block",
          nodeType: clause.nodeType,
          nodeId: clause.nodeId,
        },
        require: "exactlyOne",
      },
      args: { replacement: { text: edit.replacement! } },
    });
  }
  if ((await doc.info({})).revision !== source.revision)
    throw new Error("The document changed while resolving the proposal.");
  return {
    atomic: true,
    changeMode: "tracked",
    expectedRevision: source.revision,
    steps,
  };
}
export async function previewDeal(doc: BrowserDocumentApi, source: Snapshot) {
  const plan = await buildPlan(doc, source);
  const preview = await doc.mutations.preview(plan);
  if (!preview.valid)
    throw new Error(
      preview.failures?.map((f) => f.message).join(" ") ||
        "SuperDoc could not validate this proposal.",
    );
  return { plan, preview };
}
export async function applyDeal(
  doc: BrowserDocumentApi,
  source: Snapshot,
  plan: TrackedPlan,
): Promise<AppliedDeal> {
  // Rebuild to check all current target and overlap guards, then execute the held plan.
  const freshPlan = await buildPlan(doc, source);
  if (JSON.stringify(freshPlan) !== JSON.stringify(plan))
    throw new Error("The prepared targets changed. Prepare a fresh proposal.");
  const before = await listChanges(doc);
  const beforeDetails = await Promise.all(
    before.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  const receipt = await doc.mutations.apply(plan);
  const after = await listChanges(doc);
  const added = after.filter((c) => !before.some((b) => b.id === c.id));
  const details = await Promise.all(
    added.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  const warnings: string[] = [];
  const afterRevision = (await doc.info({})).revision;
  const suggestions: Suggestion[] = [];
  for (const e of source.edits.filter(canPropose)) {
    const clause = e.clause!;
    const ids = details
      .filter((c) => c.navigationTarget?.blockId === clause.id)
      .map((c) => c.id);
    const reported =
      receipt.steps.find((s) => s.stepId === e.id)?.trackedChangeIds ?? [];
    const match = await doc.query.match({
      select: { type: "text", pattern: e.replacement!, caseSensitive: true },
      within: {
        kind: "block",
        nodeId: clause.nodeId,
        nodeType: clause.nodeType,
      },
      require: "any",
    });
    const original = await doc.projectHtml({
      scope: {
        kind: "block",
        nodeId: clause.nodeId,
        nodeType: clause.nodeType,
      },
      reviewMode: "original",
    });
    const originalText = new DOMParser()
      .parseFromString(original.content, "text/html")
      .body.textContent?.trim();
    const trackedVerified =
      ids.length > 0 &&
      ids.every((id) => reported.includes(id)) &&
      original.status !== "failed" &&
      originalText === clause.text;
    const textVerified = match.total === 1;
    suggestions.push({
      decisionId: e.id,
      clauseId: clause.id,
      proposal: {
        original: clause.text,
        replacement: e.replacement!,
        source: "playbook",
        explanation: `Apply the supplied liability fallback consistently in ${e.label}.`,
      },
      verification: {
        applied: true,
        textVerified,
        trackedVerified,
        changeIds: ids,
        beforeRevision: source.revision,
        afterRevision,
        receipt,
      },
      fingerprints: Object.fromEntries(
        details
          .filter((c) => ids.includes(c.id))
          .map((c) => [c.id, fingerprint(c)]),
      ),
      status: textVerified && trackedVerified ? "pending" : "changed",
    });
  }
  const allAfterDetails = await Promise.all(
    after.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  const preserved = beforeDetails.every((b) =>
    allAfterDetails.some(
      (a) => a.id === b.id && fingerprint(a) === fingerprint(b),
    ),
  );
  const verified =
    preserved &&
    suggestions.every((s) => s.status === "pending") &&
    added.length ===
      suggestions.reduce((n, s) => n + s.verification.changeIds.length, 0);
  if (!verified)
    warnings.push(
      "Some document checks did not pass. Inspect the tracked changes before continuing.",
    );
  const comments: AppliedDeal["comments"] = [];
  if (verified)
    for (const s of suggestions) {
      try {
        const r = await doc.comments.create(
          {
            text: `Northstar counterproposal: ${s.proposal.explanation} This is one part of a connected proposal covering Section 6.1, the order form, and Schedule B. Review all three before returning the agreement.`,
            target: {
              kind: "trackedChange",
              trackedChangeId: s.verification.changeIds[0],
              side: "inserted",
            },
            author: "Northstar · Document agent",
            authorEmail: "agent@example.invalid",
          },
          { expectedRevision: (await doc.info({})).revision },
        );
        if (!r.success || !r.id)
          throw new Error("The explanation comment could not be verified.");
        const stored = await doc.comments.get({ commentId: r.id });
        if (!stored.text?.includes("Northstar counterproposal:"))
          throw new Error("Comment readback did not match.");
        comments.push({ clauseId: s.clauseId, id: r.id });
      } catch {
        warnings.push(
          `The text edit is verified, but its explanation comment could not be added in ${s.decisionId}.`,
        );
      }
    }
  return { suggestions, comments, receipt, preserved, verified, warnings };
}
export async function clearOwnProposal(
  doc: BrowserDocumentApi,
  applied: AppliedDeal | null,
) {
  if (!applied) return;
  const currentChanges = await listChanges(doc);
  const currentIds = new Set(currentChanges.map((c) => c.id));
  const currentDetails = await Promise.all(
    currentChanges.map((c) =>
      doc.trackChanges.get({ id: c.id, story: c.address.story }),
    ),
  );
  const { clauses } = await extractClauses(doc);
  for (const s of applied.suggestions.filter(
    (s) => s.status === "pending" || s.status === "changed",
  )) {
    const stillOwned = s.verification.changeIds.some((id) =>
      currentIds.has(id),
    );
    const otherRevision = currentDetails.some(
      (c) =>
        c.navigationTarget?.blockId === s.clauseId &&
        !s.verification.changeIds.includes(c.id),
    );
    const text = clauses.find((c) => c.id === s.clauseId)?.text;
    if (otherRevision || (stillOwned && text !== s.proposal.replacement))
      throw new Error(
        "You edited a clause with a pending suggestion. Resolve its tracked changes before rerunning. Your work has been preserved.",
      );
  }
  await validatePending(doc, applied.suggestions);
  const pending = applied.suggestions.filter(
    (s) =>
      s.status === "pending" &&
      s.verification.changeIds.some((id) => currentIds.has(id)),
  );
  await clearPending(doc, applied.suggestions);
  for (const c of applied.comments.filter((c) =>
    pending.some((s) => s.clauseId === c.clauseId),
  )) {
    const existing = await doc.comments.list({ limit: 1000 });
    if (existing.items.some((x) => x.id === c.id)) {
      const r = await doc.comments.delete(
        { commentId: c.id },
        { expectedRevision: (await doc.info({})).revision },
      );
      if (!r.success)
        throw new Error(
          "An earlier proposal comment could not be removed. Review it before rerunning.",
        );
    }
  }
}
