import { identity, digest } from "./budget";
import { getEncoding } from "js-tiktoken";
import { PublicError } from "./validation";
import type { WorkflowInput } from "../workflow/input";
import type { AppEnv } from "./env";
import { canonicalTask } from "../compare/input";
export function workflowIdentity(req: Request, env: AppEnv) {
  return identity(
    req,
    env.IP_HASH_SALT ||
      env.TYPESAFE_API_KEY ||
      env.OPENAI_API_KEY ||
      "unavailable",
  );
}
export async function workflowHash(w: WorkflowInput) {
  if (
    getEncoding("cl100k_base").encode(JSON.stringify(w.input.rows)).length >
    25000
  )
    throw new PublicError("Comparison exceeds 25,000 tokens.");
  return digest(
    JSON.stringify({
      documentHash: w.documentHash,
      approvalHash: w.approvalHash,
      version: w.version,
      safeguard: w.safeguard,
      policyVersion: w.input.version,
      policy: w.input.policy,
      task: canonicalTask(w.input),
    }),
  );
}
