import { TypeSafeClient, choice, type Questions } from "@typesafe-ai/sdk";
import { z } from "zod";
import { canonicalTask, type CompareInput } from "../compare/input";
import {
  MODELS,
  type CompareModel,
  type CompareResult,
  type CompareVerdict,
  type ModelUsage,
} from "../compare/types";
import { PRICES, pricedUsage } from "../compare/pricing";
import { VERDICTS } from "../review/types";
import { answerSchema } from "./validation";
import { digest } from "./budget";
export const COMPARISON_SETTINGS =
  "Fresh requests; no application cache or retries. OpenAI: reasoning none, strict structured verdicts, standard tier, max 2,000 output tokens. 60s timeout per provider.";
const MAX_OUTPUT = 2000;
export async function snapshotId(input: CompareInput) {
  return digest(
    JSON.stringify({
      revision: input.revision,
      version: input.version,
      task: canonicalTask(input),
    }),
  );
}
export function jevPayload(input: CompareInput) {
  const task = canonicalTask(input),
    questions: Questions = {};
  for (const q of task.questions)
    questions[q.id] = choice(q.question, q.choices);
  return { model: MODELS[0], state: task.evidence, questions };
}
export function openaiPayload(
  input: CompareInput,
  model: Exclude<CompareModel, "jev-1.13.0">,
) {
  return {
    model,
    store: false,
    service_tier: "default",
    reasoning_effort: "none",
    max_completion_tokens: MAX_OUTPUT,
    messages: [
      {
        role: "system",
        content:
          "Answer the supplied classification questions using only the supplied evidence, policies and answer choices. Return exactly one verdict per question id. Do not invent confidence scores.",
      },
      { role: "user", content: JSON.stringify(canonicalTask(input)) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "contract_verdicts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            verdicts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", enum: input.rows.map((r) => r.id) },
                  verdict: { type: "string", enum: [...VERDICTS] },
                },
                required: ["id", "verdict"],
                additionalProperties: false,
              },
            },
          },
          required: ["verdicts"],
          additionalProperties: false,
        },
      },
    },
  };
}
export function reservationParts(input: CompareInput) {
  return Object.fromEntries(
    MODELS.map((model) => {
      const body =
        model === MODELS[0] ? jevPayload(input) : openaiPayload(input, model);
      return [
        model,
        Math.ceil(
          (new TextEncoder().encode(JSON.stringify(body)).length + 8192) *
            PRICES[model].input +
            (model === MODELS[0] ? 0 : MAX_OUTPUT * PRICES[model].output),
        ),
      ];
    }),
  ) as Record<CompareModel, number>;
}
export function parseVerdicts(
  value: unknown,
  input: CompareInput,
): { verdicts: CompareVerdict[]; complete: boolean } {
  const parsed = z
    .object({
      verdicts: z.array(
        z.object({ id: z.string(), verdict: z.enum(VERDICTS) }).strict(),
      ),
    })
    .strict()
    .safeParse(value);
  if (!parsed.success) return { verdicts: [], complete: false };
  const answers = parsed.data.verdicts;
  const allowed = new Set(input.rows.map((r) => r.id));
  const valid = answers.filter(
    (v) =>
      allowed.has(v.id as CompareVerdict["id"]) &&
      answers.filter((a) => a.id === v.id).length === 1,
  ) as CompareVerdict[];
  return {
    verdicts: valid,
    complete:
      valid.length === input.rows.length &&
      answers.length === input.rows.length,
  };
}
export async function compareOne(
  model: CompareModel,
  input: CompareInput,
  snapshot: string,
  keys: { jev?: string; openai?: string },
): Promise<CompareResult> {
  const start = performance.now();
  let usage: ModelUsage | null = null;
  const base = () => ({
    model,
    snapshot,
    elapsedMs: performance.now() - start,
    usage,
  });
  if (!(model === MODELS[0] ? keys.jev : keys.openai))
    return {
      ...base(),
      status: "unavailable",
      verdicts: [],
      usage: pricedUsage(model, 0, 0),
      error: "Provider credential is unavailable; no request was sent.",
    };
  try {
    if (model === MODELS[0]) {
      const result = await new TypeSafeClient({
        apiKey: keys.jev!,
        defaultModel: model,
        retry: { maxRetries: 0 },
        timeout: 60000,
        logLevel: "off",
      }).systemOne(jevPayload(input));
      usage = pricedUsage(
        model,
        result.usage.input_tokens,
        result.usage.output_tokens,
      );
      if (result.model !== model) throw new Error("Unexpected model");
      const verdicts: CompareVerdict[] = [];
      for (const row of input.rows) {
        const answer = answerSchema.safeParse(result.answers[row.id]);
        if (answer.success)
          verdicts.push({
            id: row.id,
            verdict: answer.data.choice,
            confidence: answer.data.confidence,
            probabilities: answer.data
              .probabilities as CompareVerdict["probabilities"],
          });
      }
      const complete =
        verdicts.length === input.rows.length &&
        Object.keys(result.answers).length === input.rows.length;
      return {
        ...base(),
        status: complete ? "complete" : "incomplete",
        verdicts,
        ...(!complete
          ? { error: "Missing, extra or invalid provider answers." }
          : {}),
      };
    }
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.openai}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiPayload(input, model)),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error("Provider unavailable");
    const result = (await res.json()) as {
      model?: string;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
      choices?: {
        finish_reason: string;
        message: { content?: string; refusal?: string };
      }[];
    };
    if (result.usage)
      usage = pricedUsage(
        model,
        result.usage.prompt_tokens,
        result.usage.completion_tokens,
        result.usage.prompt_tokens_details?.cached_tokens ?? 0,
      );
    if (result.model !== model) throw new Error("Unexpected model");
    const answer = result.choices?.[0];
    if (
      result.choices?.length !== 1 ||
      answer?.finish_reason !== "stop" ||
      answer.message.refusal ||
      !answer.message.content
    )
      throw new Error("Incomplete response");
    const parsed = parseVerdicts(JSON.parse(answer.message.content), input);
    return {
      ...base(),
      status: parsed.complete ? "complete" : "incomplete",
      verdicts: parsed.verdicts,
      ...(!parsed.complete
        ? { error: "Missing, duplicate or invalid provider answers." }
        : {}),
    };
  } catch {
    return {
      ...base(),
      status: "incomplete",
      verdicts: [],
      error:
        "Provider failed, returned an unexpected model, or did not return a valid complete response. No substitute model was used.",
    };
  }
}
export function reconciledCharge(
  results: CompareResult[],
  reserved: Record<CompareModel, number>,
) {
  return MODELS.reduce((total, model) => {
    const result = results.find((r) => r.model === model);
    return (
      total +
      (result?.usage ? Math.ceil(result.usage.costUsd * 1e6) : reserved[model])
    );
  }, 0);
}
