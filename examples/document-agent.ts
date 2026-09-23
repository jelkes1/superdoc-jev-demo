/** Browser-side integration. See README for the small start/plan/finish server. */
import type { SuperDoc } from "superdoc";
import { documentIndex } from "../lib/agent/document";
import {
  transport,
  emptyLane,
  applyLane,
  fileHash,
} from "../lib/agent/browser";
import type { DraftPlan, Pipeline } from "../lib/agent/types";

export async function proposeAndReview(
  editor: SuperDoc,
  originalDocx: File,
  request: string,
  approve: (plan: DraftPlan) => Promise<string[]>,
  pipeline: Pipeline = "jev",
  signal?: AbortSignal,
) {
  const lane = emptyLane(pipeline);
  const extractionStart = performance.now();
  const snapshot = await documentIndex(
    editor.activeEditor!.doc!,
    request,
    await fileHash(originalDocx),
  );
  lane.extractionMs = performance.now() - extractionStart;
  const started = await transport.start(snapshot, [pipeline], signal);
  try {
    const planningStart = performance.now();
    lane.result = await transport.plan(
      snapshot,
      started.runId,
      pipeline,
      (event) => {
        // Render actual phase/selection completions in your UI; do not simulate answers.
        if (event.type === "phase") console.info(event.phase);
      },
      signal,
    );
    lane.planningMs = performance.now() - planningStart;
  } finally {
    await transport.finish(started.runId);
  }
  // A clarification or invalid plan has no executable edits.
  if (lane.result.status !== "complete" || lane.result.plan.clarification)
    return lane;
  const approvedIds = await approve(lane.result.plan); // Show complete language; await explicit approval.
  await applyLane(editor, snapshot, lane, approvedIds);
  // Each verified operation remains a real, reviewable revision or anchored comment.
  return lane;
}
