"use client";
import { useState } from "react";
import type { MeasurementSnapshot } from "@/lib/deal-desk/measurements";
import type { CompareInput } from "@/lib/compare/input";
import {
  MODELS,
  disagreements,
  type CompareEvent,
  type CompareResult,
} from "@/lib/compare/types";
import { PRICING_DATE } from "@/lib/compare/pricing";
export const money = (n: number) => `$${n.toFixed(n < 0.01 ? 6 : 4)}`;
export const seconds = (n: number) => `${(n / 1000).toFixed(2)}s`;
export default function RunProof({
  measurement: m,
  getSnapshot,
  disabled,
  inspect,
}: {
  measurement: MeasurementSnapshot;
  getSnapshot: () => Promise<CompareInput>;
  disabled: boolean;
  inspect: () => void;
}) {
  const [show, setShow] = useState(false),
    [ack, setAck] = useState(false),
    [running, setRunning] = useState(false),
    [error, setError] = useState("");
  const [results, setResults] = useState<CompareResult[]>([]),
    [meta, setMeta] = useState<Extract<CompareEvent, { type: "start" }>>(),
    [complete, setComplete] = useState(false);
  const cost = m.usage.reduce((n, u) => n + u.usage.costUsd, 0);
  const sum = (key: "inputTokens" | "outputTokens" | "cachedInputTokens") =>
    m.usage.reduce((n, u) => n + (u.usage[key] ?? 0), 0);
  const provider = (jev: boolean) =>
    m.usage
      .filter((u) => u.model.startsWith("jev") === jev)
      .reduce((n, u) => n + u.usage.latencyMs, 0);
  async function compare() {
    if (!ack || running) return;
    setRunning(true);
    setError("");
    setResults([]);
    setMeta(undefined);
    setComplete(false);
    try {
      const snapshot = await getSnapshot();
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Comparison-Consent": "acknowledged",
        },
        body: JSON.stringify(snapshot),
      });
      if (!res.ok)
        throw new Error(
          ((await res.json()) as { error?: string }).error ||
            "Comparison unavailable.",
        );
      if (!res.body) throw new Error("No comparison response.");
      const reader = res.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        sawComplete = false,
        id = "";
      const seen = new Set<string>();
      const receive = (line: string) => {
        const event = JSON.parse(line) as CompareEvent;
        if (event.type === "start") {
          id = event.snapshot;
          setMeta(event);
        } else if (event.type === "result") {
          if (
            !id ||
            event.result.snapshot !== id ||
            !MODELS.includes(event.result.model) ||
            seen.has(event.result.model)
          )
            throw new Error("Duplicate model result or mismatched snapshot.");
          seen.add(event.result.model);
          setResults((s) => [...s, event.result]);
        } else if (event.type === "complete") {
          if (event.snapshot !== id || seen.size !== MODELS.length)
            throw new Error(
              "Incomplete comparison: one or more model results are missing.",
            );
          sawComplete = true;
          setComplete(true);
          if (!event.budgetSettled)
            setError(
              "Usage reconciliation could not be confirmed; the reservation remains held.",
            );
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) if (line.trim()) receive(line);
        if (done) break;
      }
      if (buffer.trim()) receive(buffer);
      if (!sawComplete)
        throw new Error(
          "The comparison ended early. Completed responses are retained; missing results remain incomplete.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setRunning(false);
    }
  }
  const differing = disagreements(results);
  return (
    <section className="run-proof" aria-label="This run">
      <div className="proof-heading">
        <div>
          <span className="eyebrow">THIS RUN · DOCUMENT EXECUTION</span>
          <h2 aria-live="polite">
            {m.verified} verified Word changes{" "}
            <span>
              · {seconds(m.activeMs)} processing · {money(cost)} estimated model
              cost{m.unknownCalls ? " + unknown usage" : ""}
            </span>
          </h2>
        </div>
        <div className="proof-links">
          <button onClick={inspect}>Inspect proof</button>
          <a
            href="https://github.com/jelkes1/superdoc-jev-demo"
            target="_blank"
            rel="noreferrer"
          >
            Get the code ↗
          </a>
          <button onClick={() => setShow(!show)} aria-expanded={show}>
            Compare models
          </button>
        </div>
      </div>
      <details>
        <summary>Timing, tokens & verification evidence</summary>
        <div className="proof-detail-grid">
          <div>
            <b>Time to first verified edit</b>
            <p>
              {m.firstVerifiedMs === null
                ? "Awaiting an edit"
                : seconds(m.firstVerifiedMs)}
            </p>
            <small>
              Active processing only. Reading and approval pauses excluded.
              Initial editor loading and comparison are excluded.
            </small>
          </div>
          <div>
            <b>Where the time went</b>
            <p>
              Jev {seconds(provider(true))} · reasoning{" "}
              {seconds(provider(false))}
              <br />
              SuperDoc execution & verification{" "}
              {seconds(
                m.phases
                  .filter((p) => p.phase === "superdoc")
                  .reduce((n, p) => n + p.ms, 0),
              )}
            </p>
            <small>
              Provider times are within active elapsed time; they are not added
              twice. Extraction, network and validation occupy the remainder.
            </small>
          </div>
          <div>
            <b>Accumulated model usage</b>
            <p>
              {sum("inputTokens").toLocaleString()} input ·{" "}
              {sum("outputTokens").toLocaleString()} output ·{" "}
              {sum("cachedInputTokens").toLocaleString()} cached input
            </p>
            <small>
              {m.usage.length} reported calls · {m.unknownCalls} calls with
              unknown usage. Pricing {PRICING_DATE}; reported cache discounts
              applied.
            </small>
          </div>
          <div>
            <b>
              {m.attempted} attempted · {m.verified} verified · {m.failed}{" "}
              failed
            </b>
            <p>
              {
                m.proof.filter((p) => p.exactTarget && p.tracked && p.preserved)
                  .length
              }{" "}
              passed exact-target readback, tracked-revision and preservation
              checks.
            </p>
            <small>
              {m.proof.filter((p) => p.comment).length} comments verified
              separately. One operation can create several revision fragments.
              This is execution evidence, not legal accuracy.
            </small>
          </div>
        </div>
        <details>
          <summary>Revision and policy trace</summary>
          <pre>
            {JSON.stringify(
              {
                runId: m.runId,
                phases: m.phases,
                usage: m.usage,
                proof: m.proof,
              },
              null,
              2,
            )}
          </pre>
        </details>
      </details>
      {show && (
        <section className="comparison-panel" aria-label="Model comparison">
          <h3>Same evidence. Three decision models.</h3>
          <p>
            Freeze the current clause context and compare classification only.
            Results never modify your document. Comparison cost is separate from
            “This run”.
          </p>
          <label className="compare-consent">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={running}
            />{" "}
            I agree to send this extracted contract text to TypeSafe and OpenAI
            for comparison.
          </label>
          <button
            className="primary"
            disabled={!ack || running || disabled}
            onClick={() => void compare()}
          >
            {running
              ? "Comparing… responses appear as they finish"
              : "Run fresh comparison"}
          </button>
          {error && <p role="alert">{error}</p>}
          {(running || meta) && (
            <>
              <div className="comparison-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Exact model</th>
                      <th>Status</th>
                      <th>Provider time</th>
                      <th>Est. cost</th>
                      <th>Input / output</th>
                      <th>Valid decisions</th>
                      <th>Disagreements*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODELS.map((model) => {
                      const r = results.find((r) => r.model === model);
                      return (
                        <tr key={model}>
                          <th>{model}</th>
                          <td>
                            {r?.status ??
                              (running ? "Running" : "Missing response")}
                          </td>
                          <td>{r ? seconds(r.elapsedMs) : "—"}</td>
                          <td>
                            {r?.usage
                              ? money(r.usage.costUsd)
                              : r
                                ? "Unknown"
                                : "—"}
                          </td>
                          <td>
                            {r?.usage
                              ? `${r.usage.inputTokens} / ${r.usage.outputTokens} (${r.usage.cachedInputTokens} cached)`
                              : "—"}
                          </td>
                          <td>{r?.verdicts.length ?? "—"}</td>
                          <td>
                            {r
                              ? r.verdicts.filter((v) =>
                                  differing.includes(v.id),
                                ).length
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p>
                *Rows where returned verdicts differ; neither agreement nor
                disagreement establishes accuracy.{" "}
                {complete
                  ? "All three responses received."
                  : "Comparison incomplete."}
              </p>
              {meta && (
                <small className="snapshot-meta">
                  Snapshot SHA-256 {meta.snapshot} · document {meta.revision} ·
                  policy {meta.version} · pricing {meta.pricingDate}
                  <br />
                  {meta.settings}
                </small>
              )}
              {results.map((r) => (
                <details key={r.model}>
                  <summary>
                    {r.model} · actual response
                    {r.error ? " · needs attention" : ""}
                  </summary>
                  {r.error && <p>{r.error}</p>}
                  <pre>{JSON.stringify(r, null, 2)}</pre>
                </details>
              ))}
            </>
          )}
          <p>
            <a
              href="https://github.com/jelkes1/superdoc-jev-demo/blob/main/docs/comparison-methodology.md"
              target="_blank"
              rel="noreferrer"
            >
              Reproduce the fictional evaluation & read the methodology ↗
            </a>
          </p>
        </section>
      )}
    </section>
  );
}
