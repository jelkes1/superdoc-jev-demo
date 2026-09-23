import { getEncoding } from "js-tiktoken";
import {
  snapshotSchema,
  TOOLS,
  type Snapshot,
  type Block,
  type Selection,
  type SelectionDecision,
  type ToolName,
  type DraftPlan,
} from "./types";
const encoder = getEncoding("o200k_base");
export const tokens = (s: string) => encoder.encode(s).length;
export function validateSnapshot(input: unknown): Snapshot {
  const s = snapshotSchema.parse(input),
    ids = new Set(s.blocks.map((b) => b.id));
  if (
    ids.size !== s.blocks.length ||
    new Set(s.blocks.map((b) => b.nodeId)).size !== s.blocks.length
  )
    throw new Error("Duplicate document blocks.");
  if (tokens(s.blocks.map((b) => b.text).join("\n")) > 25000)
    throw new Error("The document exceeds 25,000 extracted tokens.");
  for (const b of s.blocks)
    if (b.dependencies.some((id) => !ids.has(id)))
      throw new Error("Unknown dependency target.");
  return s;
}
export const evidence = (blocks: Block[]) =>
  blocks.map((b) => ({
    id: b.id,
    title: b.title,
    section: b.section,
    text: b.text,
    table: b.table,
    protectedByExistingRevisions: b.existingRevisions.length > 0,
  }));
export function assemble(
  s: Snapshot,
  ids: string[],
  tools: ToolName[],
  decisions: SelectionDecision[] = [],
): Selection {
  const chosen = new Set(ids),
    byId = new Map(s.blocks.map((b) => [b.id, b]));
  let fallback: string | null = null;
  if (!chosen.size)
    fallback =
      "No confident context selection; using the full supported document.";
  for (const id of chosen) {
    const b = byId.get(id);
    if (!b) throw new Error("Selection returned an unknown block.");
    for (const d of b.dependencies) chosen.add(d);
    if (b.unresolvedRefs.length)
      fallback =
        "An unresolved cross-reference requires the full supported document.";
  }
  if (fallback) s.blocks.forEach((b) => chosen.add(b.id));
  return {
    ids: s.blocks.filter((b) => chosen.has(b.id)).map((b) => b.id),
    tools: tools.length ? tools : ["replace", "comment"],
    decisions,
    fallback,
  };
}
export function fromDecisions(
  s: Snapshot,
  decisions: SelectionDecision[],
): Selection {
  const byId = new Map(decisions.map((d) => [d.id, d]));
  if (
    byId.size !== decisions.length ||
    s.blocks.some((b) => !byId.has(b.id)) ||
    TOOLS.some((t) => !byId.has(`tool:${t.name}`))
  )
    throw new Error("Missing or duplicate selection decisions.");
  const keep = (id: string) => {
    const d = byId.get(id)!;
    return d.verdict !== "IRRELEVANT" || d.confidence < 0.95;
  };
  return assemble(
    s,
    s.blocks.filter((b) => keep(b.id)).map((b) => b.id),
    TOOLS.filter((t) => keep(`tool:${t.name}`)).map((t) => t.name),
    decisions,
  );
}
const words = (s: string) =>
  s
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(
      (w) =>
        w.length > 2 &&
        !new Set([
          "the",
          "and",
          "this",
          "with",
          "from",
          "every",
          "throughout",
          "change",
        ]).has(w),
    ) ?? [];
/** Deterministic BM25 baseline; no embedding or model call. */
export function keywordSelection(s: Snapshot): Selection {
  const query = [...new Set(words(s.request))],
    docs = s.blocks.map((b) => words(`${b.title} ${b.text}`)),
    avg = docs.reduce((n, d) => n + d.length, 0) / docs.length;
  const df = new Map(
    query.map((q) => [q, docs.filter((d) => d.includes(q)).length]),
  );
  const scores = docs
    .map((d, i) => ({
      id: s.blocks[i].id,
      score: query.reduce((n, q) => {
        const f = d.filter((w) => w === q).length;
        return (
          n +
          (Math.log(
            1 +
              (docs.length - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5),
          ) *
            f *
            2.2) /
            (f + 1.2 * (0.25 + (0.75 * d.length) / (avg || 1)))
        );
      }, 0),
    }))
    .sort((a, b) => b.score - a.score);
  const tools: ToolName[] = /\b(comment|annotate)\b/i.test(s.request)
    ? ["comment"]
    : ["replace"];
  return assemble(
    s,
    scores
      .filter((x) => x.score > 0)
      .slice(0, 20)
      .map((x) => x.id),
    tools,
  );
}
export function validatePlan(
  s: Snapshot,
  selection: Selection,
  plan: DraftPlan,
): DraftPlan {
  if (plan.clarification && plan.edits.length)
    throw new Error("Clarification must precede document changes.");
  if (new Set(plan.edits.map((e) => e.id)).size !== plan.edits.length)
    throw new Error("Duplicate operation ids.");
  if (new Set(plan.edits.map((e) => e.blockId)).size !== plan.edits.length)
    throw new Error(
      "Combine changes within a block into one proposed operation.",
    );
  const ranges = new Map<string, { start: number; end: number }[]>();
  for (const e of plan.edits) {
    const b = s.blocks.find((b) => b.id === e.blockId);
    if (
      !b ||
      !selection.ids.includes(e.blockId) ||
      !selection.tools.includes(e.tool)
    )
      throw new Error("The draft used an unavailable target or operation.");
    if (b.existingRevisions.length)
      throw new Error(
        "The draft would overwrite an existing counsel revision.",
      );
    const start = b.text.indexOf(e.original);
    if (start < 0 || b.text.indexOf(e.original, start + 1) >= 0)
      throw new Error(
        "The proposed source text is not unique within its block.",
      );
    if (
      e.tool === "replace" &&
      (e.original === e.replacement || /[\r\n]/.test(e.replacement))
    )
      throw new Error(
        "Replacement must be a changed, single-paragraph text span.",
      );
    const range = { start, end: start + e.original.length },
      prior = ranges.get(b.id) ?? [];
    if (prior.some((r) => r.start < range.end && range.start < r.end))
      throw new Error("Overlapping proposed operations.");
    prior.push(range);
    ranges.set(b.id, prior);
  }
  return plan;
}
