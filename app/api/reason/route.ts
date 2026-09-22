import { appEnv } from "@/lib/server/env";
import {
  reasonSchema,
  readJson,
  errorResponse,
  PublicError,
} from "@/lib/server/validation";
import {
  reasoningRequest,
  estimatedReasonCost,
  draft,
  REASONING_MODEL,
} from "@/lib/server/reasoning";
import { identity, reserve, settle } from "@/lib/server/budget";
import { reasonToken, sameToken } from "@/lib/server/tokens";
export async function POST(request: Request) {
  try {
    const env = appEnv();
    if (!env.OPENAI_API_KEY || !env.TYPESAFE_API_KEY)
      throw new PublicError(
        "Reasoning is unavailable. This finding remains open for human review.",
        503,
      );
    if (env.REASONING_MODEL && env.REASONING_MODEL !== REASONING_MODEL)
      throw new PublicError(
        "The configured reasoning model needs a pricing review.",
        503,
      );
    const input = reasonSchema.parse(await readJson(request));
    if (
      input.clause.incomplete ||
      input.clause.text.length > 6000 ||
      input.clause.context.length > 12000
    )
      throw new PublicError(
        "More context is needed. Human review is required.",
      );
    const secret = env.IP_HASH_SALT || env.TYPESAFE_API_KEY;
    if (
      !sameToken(
        input.reasonToken,
        await reasonToken(
          secret,
          input.reviewId,
          input.clause,
          input.ruleId,
          input.playbook,
        ),
      )
    )
      throw new PublicError("This finding is not eligible for reasoning.", 403);
    const who = await identity(request, secret);
    const payload = reasoningRequest(
      input.clause,
      input.ruleId,
      input.playbook,
    );
    const reservation = await reserve(
      env.DB,
      who,
      estimatedReasonCost(payload),
      Math.round(Number(env.DAILY_BUDGET_USD ?? 10) * 1e6),
      "reason",
      input.reviewId,
    );
    const result = await draft(env.OPENAI_API_KEY, payload, input.clause);
    await settle(env.DB, reservation, result.usage.costUsd * 1e6);
    return Response.json(
      { ...result, model: REASONING_MODEL },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
