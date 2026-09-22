import { z } from "zod";
import { RULE_IDS, VERDICTS } from "../review/types";
export class PublicError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const playbookSchema = z
  .object({
    liabilityMonths: z.union([z.literal(12), z.literal(24)]),
    threshold: z.number().min(0.7).max(1),
    version: z.string().max(120),
  })
  .strict();
export const clauseSchema = z
  .object({
    id: z.string().min(1).max(160),
    title: z.string().max(1000),
    text: z.string().min(1).max(50000),
    context: z.string().max(60000),
    nodeId: z.string().max(160),
    nodeType: z.enum(["paragraph", "heading", "listItem"]),
    ordinal: z.number().int().min(0).max(1000),
    incomplete: z.boolean(),
  })
  .strict();
export const reviewSchema = z
  .object({
    clauses: z.array(clauseSchema).min(1).max(1000),
    revision: z.string().min(1).max(200),
    playbook: playbookSchema,
  })
  .strict();
export const reasonSchema = z
  .object({
    reviewId: z.string().uuid(),
    reasonToken: z.string().length(64),
    clause: clauseSchema,
    ruleId: z.enum(RULE_IDS),
    playbook: playbookSchema,
  })
  .strict();
export const answerSchema = z
  .object({
    type: z.literal("choice"),
    choice: z.enum(VERDICTS),
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.enum(VERDICTS), z.number().min(0).max(1)),
  })
  .passthrough()
  .superRefine((a, ctx) => {
    if (
      VERDICTS.some((v) => typeof a.probabilities[v] !== "number") ||
      Math.abs(Object.values(a.probabilities).reduce((x, y) => x + y, 0) - 1) >
        0.025
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid decision probabilities",
      });
  });
export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new PublicError("Expected JSON.");
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new PublicError("Cross-origin requests are not allowed.", 403);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError("Missing request body.");
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1800000) {
      await reader.cancel();
      throw new PublicError("The review request is too large.", 413);
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new PublicError("Invalid JSON.");
  }
}
export function errorResponse(e: unknown) {
  const known = e instanceof PublicError;
  return Response.json(
    {
      error: known
        ? e.message
        : e instanceof z.ZodError
          ? "The review request did not match the expected format."
          : "The service could not complete this request. Try again later.",
    },
    {
      status: known ? e.status : e instanceof z.ZodError ? 400 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
