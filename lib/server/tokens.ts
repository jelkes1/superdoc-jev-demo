import type { Clause, Playbook, RuleId } from "../review/types";
export async function reasonToken(
  secret: string,
  reviewId: string,
  clause: Clause,
  ruleId: RuleId,
  playbook: Playbook,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = JSON.stringify([reviewId, clause, ruleId, playbook]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export function sameToken(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++)
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
