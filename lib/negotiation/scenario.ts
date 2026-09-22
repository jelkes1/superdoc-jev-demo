import type { Clause, Usage, Verdict } from "../review/types";

export const DEAL_VERSION = "northstar-counterproposal-v2";
export const LOCATIONS = [
  {
    id: "body",
    label: "Main agreement",
    reference: "§ 6.1 · Liability",
    prefix:
      "Except for the data-protection obligations specified in Schedule B,",
  },
  {
    id: "order",
    label: "Order form",
    reference: "Commercial terms · Table",
    prefix: "General cap:",
  },
  {
    id: "schedule",
    label: "Data-processing schedule",
    reference: "Schedule B · § B.1",
    prefix:
      "Liability for the data-protection obligations under this Schedule B",
  },
] as const;
export type LocationId = (typeof LOCATIONS)[number]["id"];
export interface DealPolicy {
  general: 12 | 24;
  data: 24 | 36;
}
export const DEFAULT_POLICY: DealPolicy = { general: 12, data: 24 };
export const instruction = (p: DealPolicy) =>
  `Use a ${p.general}-month general liability cap and a separate ${p.data}-month cap for the data-protection obligations specified in Schedule B. Align Section 6.1, the order-form summary, and Schedule B. Preserve all other negotiated language and changes.`;
export interface DealDecision {
  locationId: LocationId;
  verdict: Verdict;
  confidence: number;
  probabilities: Record<Verdict, number>;
  model: string;
}
export interface DealReview {
  decisions: DealDecision[];
  usage: Usage;
  reviewId: string;
  revision: string;
  version: string;
}
export function findLocations(clauses: Clause[]) {
  return LOCATIONS.map((location) => {
    const matches = clauses.filter((c) => c.text.startsWith(location.prefix));
    return {
      ...location,
      clause: matches.length === 1 ? matches[0] : undefined,
      problem:
        matches.length > 1
          ? "More than one matching location. Review manually."
          : matches.length === 0
            ? "This location is missing. Review manually."
            : undefined,
    };
  });
}
// Deliberately narrow, reviewed fallback transformations for this guided fixture.
// They retain all text outside the explicit cap phrases, including later human edits.
export function replacement(
  id: LocationId,
  text: string,
  p: DealPolicy,
): string | null {
  const patterns: Record<LocationId, [RegExp, string][]> = {
    body: [
      [
        /during the (12|18|24|36) months preceding the claim\./g,
        `during the ${p.general} months preceding the claim.`,
      ],
      [
        /shall not exceed (12|18|24|36) months of such fees\./g,
        `shall not exceed ${p.data} months of such fees.`,
      ],
    ],
    order: [
      [
        /General cap: (12|18|24|36) months of fees\./g,
        `General cap: ${p.general} months of fees.`,
      ],
      [
        /Data-protection cap: (12|18|24|36) months of fees\./g,
        `Data-protection cap: ${p.data} months of fees.`,
      ],
    ],
    schedule: [
      [
        /separate aggregate cap of (12|18|24|36) months of fees/g,
        `separate aggregate cap of ${p.data} months of fees`,
      ],
    ],
  };
  let result = text;
  for (const [pattern, next] of patterns[id]) {
    if ([...result.matchAll(pattern)].length !== 1) return null;
    result = result.replace(pattern, next);
  }
  return result;
}
