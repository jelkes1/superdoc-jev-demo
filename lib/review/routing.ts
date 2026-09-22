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

// Spend the two drafting slots on substantive uncertainty before short labels
// and cross-references. Every unselected finding remains available to the human.
export function reasoningCandidates(
  decisions: Decision[],
  clauses: Clause[],
  policy: Playbook,
): Decision[] {
  const byId = new Map(clauses.map((c) => [c.id, c]));
  const score = (d: Decision) => {
    const c = byId.get(d.clauseId)!;
    return (
      Number(d.verdict !== "NOT_APPLICABLE") * 4 +
      Number(c.text.length >= 80) * 2 +
      Number(d.verdict === "NEEDS_REVIEW")
    );
  };
  return decisions
    .filter((d) => {
      const c = byId.get(d.clauseId);
      return c && d.reasonToken && routeDecision(d, c, policy) === "reason";
    })
    .sort((a, b) => score(b) - score(a))
    .slice(0, 2);
}
