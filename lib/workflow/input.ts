import { z } from "zod";
import { deskSchema } from "../compare/input";
import { MODELS } from "../compare/types";
import { WORKFLOW_VERSION } from "./types";
export const workflowSchema = z
  .object({
    input: deskSchema,
    documentHash: z.string().regex(/^[a-f0-9]{64}$/),
    approvalHash: z.string().regex(/^[a-f0-9]{64}$/),
    version: z.literal(WORKFLOW_VERSION),
    safeguard: z.boolean(),
  })
  .strict();
export const modelCallSchema = workflowSchema.extend({
  runId: z.string().uuid(),
  model: z.enum(MODELS),
});
export type WorkflowInput = z.infer<typeof workflowSchema>;
