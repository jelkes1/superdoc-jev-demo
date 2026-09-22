import { appEnv } from "@/lib/server/env";
import { JEV_MODEL } from "@/lib/server/jev";
import { REASONING_MODEL } from "@/lib/server/reasoning";
export async function GET() {
  const env = appEnv();
  return Response.json(
    {
      jev: !!env.TYPESAFE_API_KEY?.trim(),
      reasoning: !!env.OPENAI_API_KEY?.trim(),
      jevModel: JEV_MODEL,
      reasoningModel: REASONING_MODEL,
      dailyBudgetUsd: Number(env.DAILY_BUDGET_USD ?? 10),
      reviewsPerHour: 5,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
