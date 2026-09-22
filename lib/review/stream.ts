import type { ReviewEvent } from "./types";
export async function readReview(
  response: Response,
  onEvent: (event: ReviewEvent) => void,
) {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Review is unavailable. Please try later.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The server returned no review.");
  const decoder = new TextDecoder();
  let buffer = "",
    complete = false;
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let end;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ReviewEvent;
      onEvent(event);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "complete") complete = true;
    }
    if (done) break;
  }
  if (buffer.trim() || !complete)
    throw new Error(
      "The review was interrupted. No automatic edits were applied.",
    );
}
