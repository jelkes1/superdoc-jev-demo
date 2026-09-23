import type { Snapshot, Lane } from "./types";
export interface ExpectedCase {
  id: string;
  request: string;
  requiredTexts: string[];
  mustPreserve?: string[];
  expectedOperations: number;
  clarificationRequired?: boolean;
}
/** Frozen fixture checks are demonstration assertions, not legal-accuracy judgments. */
export function evaluateLane(s: Snapshot, lane: Lane, expected: ExpectedCase) {
  const required = expected.requiredTexts.map(
      (t) => s.blocks.find((b) => b.text === t)?.id,
    ),
    selected = new Set(lane.result?.selection.ids ?? []);
  const coverage = required.length
    ? required.filter((id) => id && selected.has(id)).length / required.length
    : 1;
  if (expected.clarificationRequired)
    return {
      coverage,
      agreement:
        lane.result?.status === "complete" &&
        !!lane.result.plan.clarification &&
        lane.result.plan.edits.length === 0 &&
        lane.executions.length === 0,
      missed: [],
      unexpected: [],
    };
  const good = lane.executions.filter(
      (e) => e.verified && e.edit.tool === "replace",
    ),
    edited = new Set(good.map((e) => e.edit.blockId));
  const missed = required.filter((id) => !id || !edited.has(id));
  const unexpected = good
    .filter((e) => !required.includes(e.edit.blockId))
    .map((e) => e.edit.blockId);
  const language = good.every((e) => {
    const before = s.blocks.find((b) => b.id === e.edit.blockId)?.text ?? "",
      after = before.replace(e.edit.original, e.edit.replacement);
    return expected.id === "renewal"
      ? /\b60\s+days\b/i.test(after) && !/\b15\s+days\b/i.test(after)
      : /written\s+(?:consent|permission|authori[sz]ation)/i.test(after) &&
          !/(?:without (?:separate |further )?(?:written )?(?:permission|consent)|permitted by default)/i.test(
            after,
          );
  });
  return {
    coverage,
    agreement:
      lane.result?.status === "complete" &&
      lane.result.plan.unresolved.length === 0 &&
      coverage === 1 &&
      !missed.length &&
      !unexpected.length &&
      language &&
      good.length === expected.expectedOperations &&
      lane.failed === 0 &&
      lane.executions.every((e) => e.preserved) &&
      lane.result.plan.edits.every((e) => required.includes(e.blockId)),
    missed,
    unexpected,
  };
}
export function equivalentLanes(a: Lane, b: Lane) {
  if (
    a.expectedOutcome !== true ||
    b.expectedOutcome !== true ||
    !a.executions.length ||
    !b.executions.length ||
    a.failed ||
    b.failed
  )
    return false;
  return (
    a.executions.every((e) => e.verified && e.preserved) &&
    b.executions.every((e) => e.verified && e.preserved)
  );
}
