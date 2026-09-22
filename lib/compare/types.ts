import type { Verdict } from "../review/types";
import type { RuleId } from "../deal-desk/rules";
export const MODELS = [
  "jev-1.13.0",
  "gpt-5.4-mini-2026-03-17",
  "gpt-5.4-2026-03-05",
] as const;
export type CompareModel = (typeof MODELS)[number];
// Deliberately separate from the automatic-edit Decision interface.
export interface CompareVerdict {
  id: RuleId;
  verdict: Verdict;
  confidence?: number;
  probabilities?: Record<Verdict, number>;
}
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  pricingDate: string;
}
export interface CompareResult {
  model: CompareModel;
  snapshot: string;
  status: "complete" | "incomplete" | "unavailable";
  elapsedMs: number;
  verdicts: CompareVerdict[];
  usage: ModelUsage | null;
  error?: string;
}
export type CompareEvent =
  | {
      type: "start";
      snapshot: string;
      revision: string;
      version: string;
      models: readonly CompareModel[];
      pricingDate: string;
      settings: string;
    }
  | { type: "result"; result: CompareResult }
  | { type: "complete"; snapshot: string; budgetSettled: boolean };
export function disagreements(results: CompareResult[]) {
  const ids = new Set(results.flatMap((r) => r.verdicts.map((v) => v.id)));
  return [...ids].filter(
    (id) =>
      new Set(
        results.flatMap((r) =>
          r.verdicts.filter((v) => v.id === id).map((v) => v.verdict),
        ),
      ).size > 1,
  );
}
