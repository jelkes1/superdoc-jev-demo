import { appEnv } from "@/lib/server/env";
import { errorResponse, PublicError } from "@/lib/server/validation";
import { workflowIdentity } from "@/lib/server/workflow";
import { startAgent } from "@/lib/server/agent-budget";
import { startSchema, agentHash, readAgentJson } from "@/lib/server/agent";
import { reservationSlots } from "@/lib/agent/pipeline";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      body = startSchema.parse(await readAgentJson(req)),
      who = await workflowIdentity(req, env);
    if (!env.OPENAI_API_KEY)
      throw new PublicError(
        "The drafting provider is unavailable. Editing and export remain available.",
        503,
      );
    if (
      body.pipelines.some((p) => p === "jev" || p === "interpret") &&
      !env.TYPESAFE_API_KEY
    )
      throw new PublicError(
        "Jev selection is unavailable. Try Full context.",
        503,
      );
    const r = await startAgent(
      env.DB,
      who,
      await agentHash(body.snapshot),
      reservationSlots(body.snapshot, body.pipelines),
      Math.round(Number(env.DAILY_BUDGET_USD ?? 10) * 1e6),
    );
    return Response.json(
      { runId: r.id, snapshot: r.snapshot, expires: r.expires },
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
