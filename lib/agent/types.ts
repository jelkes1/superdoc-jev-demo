import { z } from "zod";
export const AGENT_VERSION = "document-agent-v1";
export const REGISTRY_VERSION = "tracked-replace-comment-v1";
export const DRAFT_MODEL = "gpt-5.4-mini-2026-03-17";
export const SELECT_MODEL = "jev-1.13.0";
export const PIPELINES = ["full", "keyword", "jev", "interpret"] as const;
export type Pipeline = (typeof PIPELINES)[number];
export const LABELS: Record<Pipeline, string> = {
  full: "Full context",
  keyword: "Keyword search",
  jev: "Jev selection",
  interpret: "Interpret first + Jev",
};
export const PRESETS = [
  {
    id: "renewal",
    label: "Renewal notice",
    request:
      "Change renewal cancellation notice to 60 days throughout the agreement and order form.",
  },
  {
    id: "training",
    label: "Training consent",
    request:
      "Require written consent for training on customer data, including the order form and appendix. Preserve payment and liability terms.",
  },
  {
    id: "names",
    label: "Company names",
    request: "Replace every company name with ______.",
  },
] as const;
export const TOOLS = [
  {
    name: "replace",
    description:
      "Propose a tracked replacement of an exact, unique text span within one supplied block; preserve unrelated text and formatting.",
    arguments: {
      blockId: "supplied block id",
      original: "exact unique source text",
      replacement: "new text",
      explanation: "reason for this change",
    },
  },
  {
    name: "comment",
    description:
      "Propose a comment anchored to an exact, unique text span. Does not change document text.",
    arguments: {
      blockId: "supplied block id",
      original: "exact unique source text",
      replacement: "comment text",
      explanation: "reason for this comment",
    },
  },
] as const;
export type ToolName = (typeof TOOLS)[number]["name"];
export const blockSchema = z
  .object({
    id: z.string().min(1).max(160),
    nodeId: z.string().min(1).max(160),
    nodeType: z.enum(["paragraph", "heading", "listItem"]),
    text: z.string().min(1).max(6000),
    title: z.string().max(1000),
    section: z.string().max(1000),
    ordinal: z.number().int().min(0).max(1000),
    table: z.string().max(160).nullable(),
    dependencies: z.array(z.string().max(160)).max(1000),
    unresolvedRefs: z.array(z.string().max(200)).max(100),
    existingRevisions: z.array(z.string().max(160)).max(1000),
  })
  .strict();
export type Block = z.infer<typeof blockSchema>;
export const snapshotSchema = z
  .object({
    version: z.literal(AGENT_VERSION),
    registryVersion: z.literal(REGISTRY_VERSION),
    documentHash: z.string().regex(/^[a-f0-9]{64}$/),
    revision: z.string().min(1).max(200),
    blocks: z.array(blockSchema).min(1).max(1000),
    warnings: z.array(z.string().max(1000)).max(100),
    request: z.string().trim().min(1).max(2000),
  })
  .strict();
export type Snapshot = z.infer<typeof snapshotSchema>;
export const editSchema = z
  .object({
    id: z.string().min(1).max(80),
    tool: z.enum(["replace", "comment"]),
    blockId: z.string().min(1).max(160),
    original: z.string().min(1).max(6000),
    replacement: z.string().min(1).max(9000),
    explanation: z.string().max(1500),
  })
  .strict();
export type Edit = z.infer<typeof editSchema>;
export const draftSchema = z
  .object({
    summary: z.string().max(1500),
    clarification: z.string().max(1500).nullable(),
    choices: z.array(z.string().max(500)).max(3),
    edits: z.array(editSchema).max(12),
    unresolved: z.array(z.string().max(1500)).max(30),
  })
  .strict();
export type DraftPlan = z.infer<typeof draftSchema>;
export interface SelectionDecision {
  id: string;
  verdict: "RELEVANT" | "IRRELEVANT" | "UNCERTAIN";
  confidence: number;
  probabilities: Record<string, number>;
}
export interface Selection {
  ids: string[];
  tools: ToolName[];
  decisions: SelectionDecision[];
  fallback: string | null;
}
export interface Usage {
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  pricingDate: string;
  latencyMs: number;
}
export interface PlanResult {
  pipeline: Pipeline;
  snapshot: string;
  version: string;
  status: "complete" | "failed";
  selection: Selection;
  plan: DraftPlan;
  usage: Usage[];
  unknownUsage: boolean;
  phases: { phase: string; ms: number }[];
  contextTokens: number;
  fullContextTokens: number;
  toolTokens: number;
  fullToolTokens: number;
  error?: string;
  interpretation?: {
    intent: string;
    constraints: string[];
    clarification: string | null;
    choices: string[];
  };
}
export type AgentEvent =
  | { type: "phase"; phase: string; count?: number }
  | { type: "selection"; selection: Selection }
  | { type: "result"; result: PlanResult };
export interface Execution {
  edit: Edit;
  changeIds: string[];
  fingerprints: Record<string, string>;
  commentId?: string;
  beforeRevision: string;
  afterRevision: string;
  verified: boolean;
  preserved: boolean;
  commentVerified: boolean;
  receipt: unknown;
  status: "pending" | "accepted" | "rejected";
  error?: string;
}
export interface Lane {
  pipeline: Pipeline;
  result?: PlanResult;
  executions: Execution[];
  extractionMs: number;
  planningMs: number;
  executionMs: number;
  firstVerifiedMs: number | null;
  failed: number;
  timingValid: boolean;
  expectedOutcome?: boolean;
  requiredCoverage?: number;
}
export function totalCost(r?: PlanResult) {
  return !r || r.unknownUsage
    ? null
    : r.usage.reduce((n, u) => n + u.costUsd, 0);
}
export function savings(baseline: number | null, value: number | null) {
  if (baseline === null || value === null || baseline <= 0) return null;
  return {
    absolute: baseline - value,
    percent: ((baseline - value) / baseline) * 100,
  };
}
