import { appEnv } from "@/lib/server/env";
import { readJson, errorResponse } from "@/lib/server/validation";
import { workflowSchema } from "@/lib/workflow/input";
import { workflowHash, workflowIdentity } from "@/lib/server/workflow";
import { startWorkflow } from "@/lib/server/workflow-budget";
import { reservationParts, COMPARISON_SETTINGS } from "@/lib/server/comparison";
import { MODELS } from "@/lib/compare/types";
import { PRICING_DATE } from "@/lib/compare/pricing";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      body = workflowSchema.parse(await readJson(req)),
      who = await workflowIdentity(req, env);
    const r = await startWorkflow(
      env.DB,
      who,
      await workflowHash(body),
      reservationParts(body.input),
      Math.round(Number(env.DAILY_BUDGET_USD ?? 10) * 1e6),
    );
    return Response.json(
      {
        runId: r.id,
        snapshot: r.snapshot,
        expires: r.expires,
        models: MODELS,
        pricingDate: PRICING_DATE,
        settings: COMPARISON_SETTINGS,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          ...(who.cookie ? { "Set-Cookie": who.cookie } : {}),
        },
      },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
