export const RULE_IDS = [
  "liability",
  "law",
  "renewal",
  "data",
  "payment",
] as const;
export type RuleId = (typeof RULE_IDS)[number];
export const VERDICTS = [
  "ACCEPTABLE",
  "UNACCEPTABLE",
  "NEEDS_REVIEW",
  "NOT_APPLICABLE",
] as const;
export type Verdict = (typeof VERDICTS)[number];
export interface Playbook {
  liabilityMonths: 12 | 24;
  threshold: number;
  version: string;
}
export interface Clause {
  id: string;
  title: string;
  text: string;
  context: string;
  nodeId: string;
  nodeType: "paragraph" | "heading" | "listItem";
  ordinal: number;
  incomplete: boolean;
}
export interface ReviewInput {
  clauses: Clause[];
  revision: string;
  playbook: Playbook;
}
export interface Decision {
  id: string;
  clauseId: string;
  ruleId: RuleId;
  verdict: Verdict;
  confidence: number;
  probabilities: Record<Verdict, number>;
  revision: string;
  playbookVersion: string;
  model: string;
  reasonToken?: string;
}
export interface Proposal {
  original: string;
  replacement: string;
  source: "playbook" | "reasoning";
  explanation: string;
}
export interface Verification {
  applied: boolean;
  textVerified: boolean;
  trackedVerified: boolean;
  changeIds: string[];
  beforeRevision: string;
  afterRevision: string;
  receipt: unknown;
}
export interface Suggestion {
  decisionId: string;
  clauseId: string;
  proposal: Proposal;
  verification: Verification;
  fingerprints: Record<string, string>;
  status: "pending" | "accepted" | "rejected" | "changed";
}
export interface Usage {
  cachedInputTokens?: number;
  pricingDate?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  decisions: number;
}
export type ReviewEvent =
  | { type: "start"; reviewId: string; total: number; model: string }
  | { type: "batch"; decisions: Decision[]; usage: Usage }
  | { type: "complete"; usage: Usage; missingRules: RuleId[] }
  | { type: "error"; message: string };
