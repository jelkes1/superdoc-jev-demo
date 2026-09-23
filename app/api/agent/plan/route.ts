import { appEnv } from "@/lib/server/env";
import { errorResponse } from "@/lib/server/validation";
import { workflowIdentity } from "@/lib/server/workflow";
import { planSchema, agentHash, readAgentJson } from "@/lib/server/agent";
import {
  claimAgentPipeline,
  claimAgentCall,
  recordAgentUsage,
} from "@/lib/server/agent-budget";
import { runPipeline } from "@/lib/agent/pipeline";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      body = planSchema.parse(await readAgentJson(req)),
      who = await workflowIdentity(req, env),
      hash = await agentHash(body.snapshot);
    await claimAgentPipeline(env.DB, who, body.runId, hash, body.pipeline);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (e: unknown) => {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
          } catch {
            /* disconnected reader; provider usage still settles */
          }
        };
        try {
          const result = await runPipeline(
            body.snapshot,
            body.pipeline,
            hash,
            { jev: env.TYPESAFE_API_KEY, openai: env.OPENAI_API_KEY },
            emit,
            {
              start: (slot) =>
                claimAgentCall(env.DB, who, body.runId, hash, slot),
              finish: (slot, cost) =>
                recordAgentUsage(env.DB, body.runId, slot, cost),
            },
            req.signal,
          );
          emit({ type: "result", result });
        } finally {
          try {
            controller.close();
          } catch {
            /* already cancelled */
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
