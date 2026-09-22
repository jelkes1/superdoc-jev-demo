import { appEnv } from "@/lib/server/env";
import { readJson, errorResponse } from "@/lib/server/validation";
import { modelCallSchema } from "@/lib/workflow/input";
import { workflowHash, workflowIdentity } from "@/lib/server/workflow";
import {
  claimModel,
  recordModelUsage,
  expireWorkflows,
} from "@/lib/server/workflow-budget";
import { compareOne } from "@/lib/server/comparison";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      body = modelCallSchema.parse(await readJson(req)),
      who = await workflowIdentity(req, env),
      snapshot = await workflowHash(body);
    await expireWorkflows(env.DB);
    await claimModel(env.DB, who, body.runId, snapshot, body.model);
    const result = await compareOne(body.model, body.input, snapshot, {
      jev: env.TYPESAFE_API_KEY,
      openai: env.OPENAI_API_KEY,
    });
    await recordModelUsage(
      env.DB,
      body.runId,
      body.model,
      result.usage ? Math.ceil(result.usage.costUsd * 1e6) : null,
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
