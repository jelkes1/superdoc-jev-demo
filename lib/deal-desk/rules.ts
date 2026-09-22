import type { Usage, Verdict } from "../review/types";
export const VERSION = "living-deal-desk-v3";
export type Policy = {
  training: "consent" | "prohibited";
  notice: 30 | 60 | 90;
};
export const DEFAULT_POLICY: Policy = { training: "consent", notice: 30 };
export const SAFEGUARD =
  "Customer Data, including de-identified excerpts, must not be used to train shared or general-purpose models unless Customer gives specific prior written consent. This restriction prevails over any conflicting permission in Section 7 or an order form.";
export const RULES = [
  {
    id: "training",
    group: "Data use",
    label: "Training permission",
    location: "§ 7.1 · Agreement",
    prefix: "Provider may use Customer Data to train",
    alignedPrefix: "Provider shall not use Customer Data to train",
    kind: "replace",
    instruction:
      "Customer Data training requires specific prior written consent. A perpetual or default permission is not agreed.",
  },
  {
    id: "training-order",
    group: "Data use",
    label: "Order-form permission",
    location: "Order form · Table cell",
    prefix: "Model training",
    kind: "replace",
    instruction:
      "The order form must reflect the agreed training restriction, not default permission.",
  },
  {
    id: "renewal",
    group: "Renewal",
    label: "Cancellation window",
    location: "§ 5.2 · Agreement",
    prefix: "The subscription automatically renews",
    kind: "replace",
    instruction: "Non-renewal notice must match the agreed notice period.",
  },
  {
    id: "renewal-order",
    group: "Renewal",
    label: "Order-form notice",
    location: "Order form · Table cell",
    prefix: "Non-renewal notice:",
    kind: "replace",
    instruction:
      "The summary notice period must match the agreed notice period.",
  },
  {
    id: "safeguard",
    group: "Data use",
    label: "Numbered safeguard",
    location: "Schedule C · Numbered list",
    prefix: "Provider will maintain the security measures",
    kind: "insert",
    instruction:
      "Schedule C must include an express training restriction covering de-identified excerpts and prevailing over conflicting permissions. If absent, identify the omission.",
  },
  {
    id: "signals",
    group: "Human decisions",
    label: "Telemetry exception",
    location: "§ 7.2 · Agreement",
    prefix: "Provider may use Operational Signals",
    kind: "review",
    instruction:
      "The treatment of Operational Signals and de-identified excerpts was not settled. Scope and consent are unresolved. This requires human review even if a reading seems likely.",
  },
  {
    id: "payment",
    group: "Preserve concessions",
    label: "Agreed payment terms",
    location: "§ 4.2 · Counsel redline",
    prefix: "Customer shall pay each undisputed invoice",
    kind: "preserve",
    instruction:
      "The agreed payment period is 30 days. Preserve counsel’s existing tracked change; do not change this clause.",
  },
  {
    id: "liability",
    group: "Human decisions",
    label: "Competing liability position",
    location: "Schedule B · Counsel redline",
    prefix:
      "Liability for the data-protection obligations under this Schedule B",
    kind: "review",
    instruction:
      "Counsel requested 36 months of fees. Our authority is 24 months. There is no agreement; this is a negotiation decision requiring a human.",
  },
] as const;
export type Rule = (typeof RULES)[number];
export type RuleId = Rule["id"];
export interface Decision {
  id: RuleId;
  verdict: Verdict;
  confidence: number;
  probabilities: Record<Verdict, number>;
  model: string;
}
export interface Review {
  reasoning?: {
    reviewId: string;
    clause: import("../review/types").Clause;
    playbook: import("../review/types").Playbook;
    token: string;
  };
  decisions: Decision[];
  usage: Usage;
  revision: string;
  version: string;
  reviewId: string;
}
export function requirement(r: Rule, p: Policy) {
  return `${r.instruction} Agreed terms: ${p.training === "consent" ? "Training requires specific prior written consent." : "No use of Customer Data for model training is permitted, even with consent under this agreement."} Renewal cancellation notice: ${p.notice} days. Preserve existing negotiated revisions. Missing, ambiguous, and unagreed provisions require human review.`;
}
export function proposedText(r: Rule, text: string, p: Policy): string | null {
  const trainingOriginal =
    "Provider may use Customer Data to train general-purpose machine learning models without obtaining further permission from Customer. Customer grants a perpetual license for this purpose.";
  const trainingConsent =
    "Provider shall not use Customer Data to train shared or general-purpose machine learning models without Customer’s specific prior written consent. Any consent must identify the permitted data, purpose and duration; no perpetual training license is granted.";
  const trainingProhibited =
    "Provider shall not use Customer Data to train shared or general-purpose machine learning models. No training license is granted under this agreement.";
  if (
    r.id === "training" &&
    ![trainingOriginal, trainingConsent, trainingProhibited].includes(text)
  )
    return null;
  if (
    r.id === "training-order" &&
    ![
      "Model training permitted by default.",
      "Model training requires Customer’s specific prior written consent. No default or perpetual license.",
      "Model training using Customer Data is prohibited.",
    ].includes(text)
  )
    return null;
  if (
    r.id === "renewal-order" &&
    !/^Non-renewal notice: (15|30|60|90) days\.$/.test(text)
  )
    return null;
  if (r.id === "training")
    return p.training === "consent"
      ? "Provider shall not use Customer Data to train shared or general-purpose machine learning models without Customer’s specific prior written consent. Any consent must identify the permitted data, purpose and duration; no perpetual training license is granted."
      : "Provider shall not use Customer Data to train shared or general-purpose machine learning models. No training license is granted under this agreement.";
  if (r.id === "training-order")
    return p.training === "consent"
      ? "Model training requires Customer’s specific prior written consent. No default or perpetual license."
      : "Model training using Customer Data is prohibited.";
  if (r.id === "renewal")
    return /at least (15|30|60|90) days/.test(text)
      ? text.replace(/at least (15|30|60|90) days/, `at least ${p.notice} days`)
      : null;
  if (r.id === "renewal-order") return `Non-renewal notice: ${p.notice} days.`;
  if (r.id === "safeguard")
    return p.training === "consent"
      ? SAFEGUARD
      : "Customer Data, including de-identified excerpts, must not be used to train shared or general-purpose models. This restriction prevails over any conflicting permission in Section 7 or an order form.";
  return null;
}
