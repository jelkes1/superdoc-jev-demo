import type { CompareModel, ModelUsage } from "./types";
export const PRICING_DATE = "2026-09-22";
export const PRICES: Record<
  CompareModel,
  { input: number; cached: number; output: number }
> = {
  "jev-1.13.0": { input: 0.042, cached: 0.042, output: 0 },
  "gpt-5.4-mini-2026-03-17": { input: 0.75, cached: 0.075, output: 4.5 },
  "gpt-5.4-2026-03-05": { input: 2.5, cached: 0.25, output: 15 },
};
export function pricedUsage(
  model: CompareModel,
  input: number,
  output: number,
  cached = 0,
): ModelUsage {
  if (
    ![input, output, cached].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    cached > input
  )
    throw new Error("Invalid reported usage");
  const p = PRICES[model];
  return {
    inputTokens: input,
    outputTokens: output,
    cachedInputTokens: cached,
    costUsd:
      ((input - cached) * p.input + cached * p.cached + output * p.output) /
      1e6,
    pricingDate: PRICING_DATE,
  };
}
