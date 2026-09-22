import type { Playbook, RuleId, Proposal, Clause } from "./types";
export function playbook(
  liabilityMonths: 12 | 24 = 12,
  threshold = 0.95,
): Playbook {
  return {
    liabilityMonths,
    threshold,
    version: `vendor-v1-liability-${liabilityMonths}-threshold-${Math.round(threshold * 100)}`,
  };
}
export const RULE_LABELS: Record<RuleId, string> = {
  liability: "Limitation of liability",
  law: "Governing law",
  renewal: "Automatic renewal",
  data: "Customer data use",
  payment: "Payment terms",
};
export function rules(p: Playbook): Record<RuleId, string> {
  return {
    liability: `Vendor policy: aggregate liability must be capped at no more than fees paid or payable during ${p.liabilityMonths} months. An uncapped obligation or larger cap violates this policy. Missing definitions or unclear carve-outs require review.`,
    law: "Vendor policy: the agreement must be governed by Delaware or New York law. A different jurisdiction violates this policy. A venue reference alone does not establish governing law.",
    renewal:
      "Vendor policy: automatic renewal must permit either party to cancel with a notice window of at least 30 days before term end. A clause specifying 15 days violates this illustrative policy. This is a deliberately explicit demo policy, not a statement of legal best practice.",
    data: "Vendor commitment: training models on Customer Data or excerpts derived from it requires Customer’s explicit opt-in permission. Service delivery authorization, de-identification, opt-out defaults and vague improvement rights do not clearly grant such opt-in permission. Unclear scope requires review.",
    payment:
      "Vendor policy: undisputed invoices must be due no later than 30 days after receipt. A longer payment period violates this policy. Invoice-dispute notice periods are not payment deadlines.",
  };
}
// Intentionally narrow. We never overwrite an unfamiliar paragraph with a canned clause.
export function deterministicProposal(
  clause: Clause,
  rule: RuleId,
  p: Playbook,
): Proposal | null {
  const t = clause.text;
  let replacement: string | null = null;
  const value = Number(t.match(/\b(\d{1,2}) (?:months|days)\b/)?.[1]);
  if (
    rule === "liability" &&
    value > p.liabilityMonths &&
    /^Each party’s aggregate liability arising out of or relating to this agreement shall not exceed the fees paid or payable under this agreement during the \d{1,2} months preceding the event giving rise to the claim\.$/.test(
      t,
    )
  )
    replacement = t.replace(/\d{1,2} months/, `${p.liabilityMonths} months`);
  if (
    rule === "payment" &&
    value > 30 &&
    /^Customer shall pay each undisputed invoice within \d{1,2} days after receipt\.$/.test(
      t,
    )
  )
    replacement = t.replace(/\d{1,2} days/, "30 days");
  if (
    rule === "renewal" &&
    value < 30 &&
    /^The subscription automatically renews for successive twelve-month terms unless either party gives written notice of non-renewal at least \d{1,2} days before the end of the then-current term\.$/.test(
      t,
    )
  )
    replacement = t.replace(/\d{1,2} days/, "30 days");
  return replacement && replacement !== t && !clause.incomplete
    ? {
        original: t,
        replacement,
        source: "playbook",
        explanation:
          "Uses the playbook’s predefined wording for this exact clause pattern.",
      }
    : null;
}
