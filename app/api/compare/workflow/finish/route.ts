import { z } from "zod";
import { appEnv } from "@/lib/server/env";
import { readJson, errorResponse } from "@/lib/server/validation";
import { workflowIdentity } from "@/lib/server/workflow";
import { finishWorkflow } from "@/lib/server/workflow-budget";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      { runId } = z
        .object({ runId: z.string().uuid() })
        .strict()
        .parse(await readJson(req));
    await finishWorkflow(env.DB, await workflowIdentity(req, env), runId);
    return Response.json(
      { closed: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
