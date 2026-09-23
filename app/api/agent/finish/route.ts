import { z } from "zod";
import { appEnv } from "@/lib/server/env";
import { errorResponse, readJson } from "@/lib/server/validation";
import { workflowIdentity } from "@/lib/server/workflow";
import { finishAgent } from "@/lib/server/agent-budget";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      { runId } = z
        .object({ runId: z.string().uuid() })
        .strict()
        .parse(await readJson(req));
    await finishAgent(env.DB, await workflowIdentity(req, env), runId);
    return Response.json(
      { closed: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
