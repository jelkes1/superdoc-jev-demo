import type { CompareModel, CompareResult } from "../compare/types";
import type { Operation } from "../deal-desk/document";
import type { RuleId } from "../deal-desk/rules";

export const WORKFLOW_VERSION = "approved-word-workflow-v1";
export const REPLACEMENTS: RuleId[] = [
  "training",
  "training-order",
  "renewal",
  "renewal-order",
];
export interface WorkflowResult {
  model: CompareModel;
  snapshot: string;
  documentHash: string;
  version: string;
  safeguard: boolean;
  status: "complete" | "incomplete";
  comparison: CompareResult;
  timing: {
    extractionMs: number;
    decisionMs: number;
    executionMs: number;
    activeMs: number;
    firstVerifiedMs: number | null;
  };
  timingValid: boolean;
  operations: Operation[];
  attempted: number;
  failed: number;
  unresolved: RuleId[];
  preserved: boolean;
  expectedOutcome: boolean;
  outcome: string;
  errors: string[];
}
export interface WorkflowArtifact {
  result: WorkflowResult;
  blob?: Blob;
}

export function reduction(baseline: number | null, jev: number | null) {
  if (
    baseline === null ||
    jev === null ||
    !Number.isFinite(baseline) ||
    !Number.isFinite(jev) ||
    baseline <= 0 ||
    jev < 0
  )
    return null;
  return {
    absolute: baseline - jev,
    percent: ((baseline - jev) / baseline) * 100,
  };
}
export function equivalent(a?: WorkflowResult, b?: WorkflowResult): boolean {
  return !!(
    a &&
    b &&
    a.status === "complete" &&
    b.status === "complete" &&
    a.expectedOutcome &&
    b.expectedOutcome &&
    a.preserved &&
    b.preserved &&
    !a.failed &&
    !b.failed &&
    a.operations.length &&
    b.operations.length &&
    a.operations.every((x) => x.verified) &&
    b.operations.every((x) => x.verified) &&
    a.snapshot === b.snapshot &&
    a.documentHash === b.documentHash &&
    a.version === b.version &&
    a.safeguard === b.safeguard &&
    a.outcome === b.outcome
  );
}
export function savings(a?: WorkflowResult, b?: WorkflowResult) {
  if (!equivalent(a, b)) return { equivalent: false, time: null, cost: null };
  return {
    equivalent: true,
    time:
      a!.timingValid && b!.timingValid
        ? reduction(b!.timing.activeMs, a!.timing.activeMs)
        : null,
    cost: reduction(
      b!.comparison.usage?.costUsd ?? null,
      a!.comparison.usage?.costUsd ?? null,
    ),
  };
}
export function rotatedModels<T>(
  models: readonly T[],
  repetition: number,
): T[] {
  const n = ((repetition % models.length) + models.length) % models.length;
  return [...models.slice(n), ...models.slice(0, n)];
}
