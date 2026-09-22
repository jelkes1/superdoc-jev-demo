import type { Usage } from "../review/types";
import type { Operation } from "./document";
export type Phase = "review" | "reasoning" | "superdoc";
export interface MeasurementSnapshot {
  runId: string;
  activeMs: number;
  firstVerifiedMs: number | null;
  attempted: number;
  verified: number;
  failed: number;
  unknownCalls: number;
  usage: {
    model: string;
    usage: Usage;
    revision: string;
    policyVersion: string;
  }[];
  phases: {
    phase: Phase;
    ms: number;
    revision: string;
    policyVersion: string;
  }[];
  proof: {
    ruleId: string;
    beforeRevision: string;
    afterRevision: string;
    exactTarget: boolean;
    tracked: boolean;
    preserved: boolean;
    comment: boolean;
  }[];
}
// One active interval at a time. Provider duration is a subspan, never added to elapsed time.
export class RunMeasurements {
  private value: MeasurementSnapshot;
  private active?: {
    start: number;
    phase: Phase;
    revision: string;
    policyVersion: string;
  };
  constructor(
    private now: () => number = () => performance.now(),
    runId = "pending-document",
  ) {
    this.value = {
      runId,
      activeMs: 0,
      firstVerifiedMs: null,
      attempted: 0,
      verified: 0,
      failed: 0,
      unknownCalls: 0,
      usage: [],
      phases: [],
      proof: [],
    };
  }
  begin(phase: Phase, revision: string, policyVersion: string) {
    if (this.active) throw new Error("Processing intervals must not overlap");
    this.active = { start: this.now(), phase, revision, policyVersion };
  }
  end() {
    if (!this.active) return;
    const { start, ...meta } = this.active;
    const ms = Math.max(0, this.now() - start);
    this.value.activeMs += ms;
    this.value.phases.push({ ...meta, ms });
    this.active = undefined;
  }
  attempt() {
    this.value.attempted++;
  }
  operation(op?: Operation) {
    if (!op?.verified) {
      this.value.failed++;
      return;
    }
    this.value.verified++;
    this.value.firstVerifiedMs ??=
      this.value.activeMs +
      (this.active ? Math.max(0, this.now() - this.active.start) : 0);
    this.value.proof.push({
      ruleId: op.id,
      beforeRevision: op.beforeRevision,
      afterRevision: op.afterRevision,
      exactTarget: op.verified,
      tracked: op.changeIds.length > 0,
      preserved: op.preserved,
      comment: !!op.commentId && !op.warning,
    });
  }
  usage(model: string, usage: Usage, revision: string, policyVersion: string) {
    if (
      ![usage.inputTokens, usage.outputTokens].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      !Number.isFinite(usage.costUsd) ||
      usage.costUsd < 0
    ) {
      this.unknown();
      return;
    }
    this.value.usage.push({ model, usage, revision, policyVersion });
  }
  unknown() {
    this.value.unknownCalls++;
  }
  snapshot(): MeasurementSnapshot {
    return structuredClone(this.value);
  }
}
