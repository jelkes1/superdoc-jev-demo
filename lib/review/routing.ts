import type { Clause, Decision, Playbook } from "./types";
import { deterministicProposal } from "./playbook";
export type Route = "unchanged" | "propose" | "reason" | "human" | "irrelevant";
export function routeDecision(d: Decision, c: Clause, p: Playbook): Route {
  if (c.incomplete) return "human";
  if (d.verdict === "NEEDS_REVIEW" || d.confidence < 0.7) return "reason";
  if (d.verdict === "NOT_APPLICABLE")
    return d.confidence >= p.threshold ? "irrelevant" : "human";
  if (d.verdict === "ACCEPTABLE")
    return d.confidence >= p.threshold ? "unchanged" : "human";
  if (d.confidence >= p.threshold && deterministicProposal(c, d.ruleId, p))
    return "propose";
  return d.confidence >= p.threshold ? "reason" : "human";
}
