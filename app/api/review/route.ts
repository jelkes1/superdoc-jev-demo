import { appEnv } from "@/lib/server/env";
import {
  reviewSchema,
  readJson,
  errorResponse,
  PublicError,
} from "@/lib/server/validation";
import {
  batches,
  estimatedJevCost,
  evaluateBatch,
  JEV_MODEL,
} from "@/lib/server/jev";
import { identity, reserve, settle, prune } from "@/lib/server/budget";
import { reasonToken } from "@/lib/server/tokens";
import { routeDecision } from "@/lib/review/routing";
import { playbook } from "@/lib/review/playbook";
import { RULE_IDS, type ReviewEvent, type Usage } from "@/lib/review/types";
import { getEncoding } from "js-tiktoken";
export async function POST(request: Request) {
  try {
    const env = appEnv();
    if (!env.TYPESAFE_API_KEY?.trim())
      throw new PublicError(
        "Live Jev review is not connected yet. You can explore, edit and export the document.",
        503,
      );
    if (env.JEV_MODEL && env.JEV_MODEL !== JEV_MODEL)
      throw new PublicError(
        "The configured Jev model needs a pricing and compatibility review.",
        503,
      );
    const input = reviewSchema.parse(await readJson(request));
    if (
      new Set(input.clauses.map((c) => c.id)).size !== input.clauses.length ||
      new Set(input.clauses.map((c) => c.ordinal)).size !== input.clauses.length
    )
      throw new PublicError("Duplicate clause identifiers.");
    if (
      input.clauses.some(
        (c) =>
          c.id !== c.nodeId ||
          (!c.incomplete && (c.text.length > 6000 || c.context.length > 12000)),
      )
    )
      throw new PublicError("Invalid or incomplete clause context.");
    const canonical = playbook(
      input.playbook.liabilityMonths,
      input.playbook.threshold,
    );
    if (input.playbook.version !== canonical.version)
      throw new PublicError("Unknown playbook version.");
    if (
      getEncoding("o200k_base").encode(
        input.clauses.map((c) => c.text).join("\n"),
      ).length > 25000
    )
      throw new PublicError(
        "This document exceeds the 25,000-token demo limit.",
        413,
      );
    const all = batches(input);
    if (!all.length)
      throw new PublicError(
        "All clauses have incomplete context. Please review this document manually.",
      );
    const secret = env.IP_HASH_SALT || env.TYPESAFE_API_KEY;
    const who = await identity(request, secret);
    const reservation = await reserve(
      env.DB,
      who,
      estimatedJevCost(all),
      Math.round(Number(env.DAILY_BUDGET_USD ?? 10) * 1e6),
      "review",
    );
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: ReviewEvent) => {
          if (!cancelled)
            controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        };
        const totals: Usage = {
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs: 0,
          decisions: 0,
        };
        const start = performance.now();
        const present = new Set<string>();
        try {
          send({
            type: "start",
            reviewId: reservation.id,
            total: all.reduce((n, b) => n + b.clauses.length * 5, 0),
            model: JEV_MODEL,
          });
          for (const b of all) {
            if (cancelled) throw new Error("Disconnected");
            const result = await evaluateBatch(env.TYPESAFE_API_KEY!, b, input);
            for (const d of result.decisions) {
              if (d.verdict !== "NOT_APPLICABLE") present.add(d.ruleId);
              const c = b.clauses.find((c) => c.id === d.clauseId)!;
              if (routeDecision(d, c, input.playbook) === "reason")
                d.reasonToken = await reasonToken(
                  secret,
                  reservation.id,
                  c,
                  d.ruleId,
                  input.playbook,
                );
            }
            totals.inputTokens += result.usage.inputTokens;
            totals.outputTokens += result.usage.outputTokens;
            totals.costUsd += result.usage.costUsd;
            totals.decisions += result.usage.decisions;
            totals.latencyMs = performance.now() - start;
            send({ type: "batch", ...result });
          }
          await settle(env.DB, reservation, totals.costUsd * 1e6);
          await prune(env.DB);
          send({
            type: "complete",
            usage: totals,
            missingRules: RULE_IDS.filter((r) => !present.has(r)),
          });
        } catch {
          send({
            type: "error",
            message:
              "The provider could not complete the review. Partial decisions remain visible; no automatic edits were applied. Try again later. The reserved allowance is retained when usage is uncertain.",
          });
        } finally {
          if (!cancelled) controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const headers: Record<string, string> = {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    };
    if (who.cookie) headers["Set-Cookie"] = who.cookie;
    return new Response(stream, { headers });
  } catch (e) {
    return errorResponse(e);
  }
}
