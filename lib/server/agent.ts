import { z } from "zod";
import { digest } from "./budget";
import { readJson } from "./validation";
import { validateSnapshot } from "../agent/selection";
import { PIPELINES, type Snapshot } from "../agent/types";
export const startSchema = z
  .object({
    snapshot: z.unknown().transform(validateSnapshot),
    pipelines: z.array(z.enum(PIPELINES)).min(1).max(4),
  })
  .strict()
  .refine(
    (x) => new Set(x.pipelines).size === x.pipelines.length,
    "Duplicate pipelines",
  );
export const planSchema = z
  .object({
    snapshot: z.unknown().transform(validateSnapshot),
    runId: z.string().uuid(),
    pipeline: z.enum(PIPELINES),
  })
  .strict();
export const agentHash = (s: Snapshot) => digest(JSON.stringify(s));
// Agent indexes contain structured metadata in addition to the bounded extracted text.
export async function readAgentJson(req: Request) {
  return readJson(req);
}
