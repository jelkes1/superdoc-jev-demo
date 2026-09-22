import { appEnv } from "@/lib/server/env";
import { deskSchema } from "@/lib/compare/input";
import {
  MODELS,
  type CompareEvent,
  type CompareResult,
} from "@/lib/compare/types";
import { PRICING_DATE } from "@/lib/compare/pricing";
import {
  COMPARISON_SETTINGS,
  snapshotId,
  reservationParts,
  compareOne,
  reconciledCharge,
} from "@/lib/server/comparison";
import { identity, reserve, settle } from "@/lib/server/budget";
import { readJson, errorResponse, PublicError } from "@/lib/server/validation";
import { getEncoding } from "js-tiktoken";
export async function POST(req: Request) {
  try {
    const env = appEnv(),
      input = deskSchema.parse(await readJson(req));
    if (
      getEncoding("cl100k_base").encode(JSON.stringify(input.rows)).length >
      25000
    )
      throw new PublicError("Comparison context exceeds 25,000 tokens.");
    const snapshot = await snapshotId(input),
      parts = reservationParts(input);
    const who = await identity(
      req,
      env.IP_HASH_SALT ||
        env.TYPESAFE_API_KEY ||
        env.OPENAI_API_KEY ||
        "unavailable",
    );
    const reserved = await reserve(
      env.DB,
      who,
      Object.values(parts).reduce((a, b) => a + b, 0),
      Math.round(Number(env.DAILY_BUDGET_USD ?? 10) * 1e6),
      "compare",
    );
    const encoder = new TextEncoder();
    let disconnected = false;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: CompareEvent) => {
          if (!disconnected) {
            try {
              controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
            } catch {
              disconnected = true;
            }
          }
        };
        send({
          type: "start",
          snapshot,
          revision: input.revision,
          version: input.version,
          models: MODELS,
          pricingDate: PRICING_DATE,
          settings: COMPARISON_SETTINGS,
        });
        // Keep accounting alive even when the browser stops reading the response.
        const results: CompareResult[] = await Promise.all(
          MODELS.map(async (model) => {
            const result = await compareOne(model, input, snapshot, {
              jev: env.TYPESAFE_API_KEY,
              openai: env.OPENAI_API_KEY,
            });
            send({ type: "result", result });
            return result;
          }),
        );
        let budgetSettled = false;
        try {
          await settle(env.DB, reserved, reconciledCharge(results, parts));
          budgetSettled = true;
        } catch {
          /* Full reservation remains if settlement cannot be confirmed. */
        }
        send({ type: "complete", snapshot, budgetSettled });
        if (!disconnected) controller.close();
      },
      cancel() {
        disconnected = true;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-store",
        ...(who.cookie ? { "Set-Cookie": who.cookie } : {}),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
