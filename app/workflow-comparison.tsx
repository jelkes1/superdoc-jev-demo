"use client";
import { useEffect, useRef, useState } from "react";
import { MODELS, disagreements, type CompareModel } from "@/lib/compare/types";
import { PRICING_DATE } from "@/lib/compare/pricing";
import {
  savings,
  reduction,
  type WorkflowArtifact,
} from "@/lib/workflow/types";
import benchmark from "@/lib/workflow/benchmark.json";
import {
  modelLabel,
  openCopy,
  prepareWorkflow,
  runWorkflow,
  type FrozenWorkflow,
} from "@/lib/workflow/browser";
import { money, seconds } from "@/lib/compare/format";
import Brand from "./brand";

export default function WorkflowComparison({
  onBusyChange,
}: {
  onBusyChange?: (busy: boolean) => void;
}) {
  const mount = useRef<HTMLDivElement>(null),
    controller = useRef<AbortController | null>(null),
    repetition = useRef(0);
  const [frozen, setFrozen] = useState<FrozenWorkflow>(),
    [artifacts, setArtifacts] = useState<WorkflowArtifact[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [safeguard, setSafeguard] = useState(false),
    [baseline, setBaseline] = useState<CompareModel>(MODELS[1]),
    [volume, setVolume] = useState(10000),
    [preview, setPreview] = useState<WorkflowArtifact>();
  useEffect(() => {
    let canceled = false;
    void prepareWorkflow(mount.current!)
      .then((f) => {
        if (!canceled) setFrozen(f);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });
    return () => {
      canceled = true;
      controller.current?.abort();
    };
  }, []);
  async function run() {
    if (!frozen || busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setArtifacts([]);
    setPreview(undefined);
    controller.current = new AbortController();
    try {
      await runWorkflow(mount.current!, frozen, {
        safeguard,
        repetition: repetition.current++,
        signal: controller.current.signal,
        onProgress: (m, p) => setProgress(`${modelLabel(m)} · ${p}`),
        onResult: (a) => setArtifacts((s) => [...s, a]),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      setProgress(
        controller.current?.signal.aborted
          ? "Stopped. Completed results are retained."
          : "Comparison finished.",
      );
    }
  }
  const jev = artifacts.find((a) => a.result.model === MODELS[0])?.result,
    base = artifacts.find((a) => a.result.model === baseline)?.result;
  const delta = savings(jev, base),
    diff = disagreements(artifacts.map((a) => a.result.comparison));
  function download(a: WorkflowArtifact) {
    if (!a.blob) return;
    const url = URL.createObjectURL(a.blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `${a.result.model}-superdoc-comparison.docx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="workflow-comparison"
      aria-label="Workflow ROI comparison"
    >
      <div className="workflow-heading">
        <div>
          <span className="eyebrow">SAME CONTRACT · SAME SUPERDOC ENGINE</span>
          <h3>What does the model choice save?</h3>
          <p>
            Compare the complete path from a loaded agreement to verified Word
            redlines.
          </p>
        </div>
        <span className="workflow-sample">
          Fictional agreement · 8 decisions
        </span>
      </div>
      {!busy && artifacts.length === 0 && <RecordedBenchmark />}
      <div className="workflow-setup">
        <div>
          <b>Approve the same language for each copy</b>
          <p>
            Four clause and table replacements. Existing counsel revisions stay
            in place; two negotiation questions stay with a human.
          </p>
          <details>
            <summary>Read the four replacement proposals</summary>
            {frozen?.proposals
              .filter((p) => p.id !== "safeguard")
              .map((p) => (
                <div className="workflow-proposal" key={p.id}>
                  <b>{p.label}</b>
                  <p>
                    <del>{p.before}</del>
                  </p>
                  <p>
                    <ins>{p.after}</ins>
                  </p>
                </div>
              ))}
          </details>
          <label className="safeguard-approval">
            <input
              type="checkbox"
              checked={safeguard}
              disabled={busy}
              onChange={(e) => setSafeguard(e.target.checked)}
            />
            <span>
              Also approve the missing numbered safeguard for all three copies
            </span>
          </label>
          <details>
            <summary>Read the safeguard</summary>
            <p>{frozen?.proposals.find((p) => p.id === "safeguard")?.after}</p>
          </details>
        </div>
        <div className="workflow-start">
          <button
            className="primary"
            disabled={!frozen || busy}
            onClick={() => void run()}
          >
            {loading
              ? "Preparing the agreement…"
              : busy
                ? "Comparison running…"
                : "Approve language & compare"}
          </button>
          {busy && (
            <button onClick={() => controller.current?.abort()}>
              Stop after current operation
            </button>
          )}
          <small>
            Uses independent sample copies. Your open document stays as it is.
          </small>
        </div>
      </div>
      {error && (
        <p role="alert" className="workflow-error">
          {error}
        </p>
      )}
      <p role="status" className="workflow-progress">
        {progress ||
          "Fresh requests. Identical evidence. Real, downloadable Word files."}
      </p>
      {(busy || artifacts.length > 0) && (
        <>
          <div className="workflow-baseline">
            <label>
              Compare Jev + SuperDoc with{" "}
              <select
                value={baseline}
                onChange={(e) => setBaseline(e.target.value as CompareModel)}
              >
                <option value={MODELS[1]}>GPT-5.4 mini + SuperDoc</option>
                <option value={MODELS[2]}>GPT-5.4 + SuperDoc</option>
              </select>
            </label>
            <span
              className={delta.equivalent ? "outcome-match" : "outcome-wait"}
            >
              {delta.equivalent
                ? "✓ Same approved changes verified"
                : !jev || !base
                  ? "Awaiting both outcomes"
                  : "Outcomes differ or need attention"}
            </span>
          </div>
          <div className="savings-grid">
            <div>
              <span>ACTIVE PROCESSING TIME</span>
              <strong>
                {delta.time
                  ? `${seconds(Math.abs(delta.time.absolute))} ${delta.time.absolute >= 0 ? "saved" : "longer"}`
                  : "—"}
              </strong>
              <b>
                {delta.time
                  ? `${Math.abs(delta.time.percent).toFixed(1)}% ${delta.time.absolute >= 0 ? "shorter processing time" : "longer processing time"}`
                  : "Savings require matching verified outcomes"}
              </b>
              <p>
                {jev && base
                  ? `${modelLabel(baseline)} ${seconds(base.timing.activeMs)} → Jev ${seconds(jev.timing.activeMs)}`
                  : "Extraction → decision → tracked edits → verification"}
              </p>
            </div>
            <div>
              <span>ESTIMATED MODEL SPEND</span>
              <strong>
                {delta.cost
                  ? `${money(Math.abs(delta.cost.absolute))} ${delta.cost.absolute >= 0 ? "saved" : "more"}`
                  : "—"}
              </strong>
              <b>
                {delta.cost
                  ? `${Math.abs(delta.cost.percent).toFixed(1)}% ${delta.cost.absolute >= 0 ? "lower model cost" : "higher model cost"}`
                  : "Unknown costs are never treated as zero"}
              </b>
              <p>
                {jev?.comparison.usage && base?.comparison.usage
                  ? `${modelLabel(baseline)} ${money(base.comparison.usage.costUsd)} → Jev ${money(jev.comparison.usage.costUsd)}`
                  : "Actual reported tokens × versioned prices"}
              </p>
            </div>
          </div>
          <div className="workflow-models">
            {MODELS.map((model) => {
              const a = artifacts.find((x) => x.result.model === model),
                r = a?.result;
              return (
                <article
                  key={model}
                  className={
                    model === MODELS[0] ? "model-card jev-card" : "model-card"
                  }
                >
                  <span>{modelLabel(model)} + SuperDoc</span>
                  <h4>
                    {r
                      ? `${r.operations.filter((o) => o.verified).length} verified Word changes`
                      : "Awaiting result"}
                  </h4>
                  <p>
                    {r
                      ? `${r.failed} failed · ${r.unresolved.length} unresolved`
                      : "A fresh, independent document copy"}
                  </p>
                  <dl>
                    <div>
                      <dt>Active processing</dt>
                      <dd>{r ? seconds(r.timing.activeMs) : "—"}</dd>
                    </div>
                    <div>
                      <dt>Estimated model cost</dt>
                      <dd>
                        {r?.comparison.usage
                          ? money(r.comparison.usage.costUsd)
                          : r
                            ? "Unknown"
                            : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Counsel revisions</dt>
                      <dd>
                        {r
                          ? r.preserved
                            ? "Preserved"
                            : "Needs attention"
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  {r && !r.timingValid && (
                    <p>Timing unavailable: the tab was in the background.</p>
                  )}
                  {r?.errors.map((e, i) => (
                    <p className="workflow-error" key={i}>
                      {e}
                    </p>
                  ))}
                  {a?.blob && (
                    <div className="workflow-output">
                      <button disabled={busy} onClick={() => setPreview(a)}>
                        Inspect Word output
                      </button>
                      <button onClick={() => download(a)}>Download DOCX</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="volume-projection">
            <div>
              <span className="eyebrow">AT YOUR VOLUME · PROJECTION</span>
              <label>
                <input
                  aria-label="Equivalent runs per month"
                  type="number"
                  min="1"
                  max="10000000"
                  value={volume}
                  onChange={(e) =>
                    setVolume(
                      Math.max(
                        1,
                        Math.min(10000000, Number(e.target.value) || 1),
                      ),
                    )
                  }
                />{" "}
                equivalent runs / month
              </label>
            </div>
            <div>
              <strong>
                {delta.cost
                  ? `${money(Math.abs(delta.cost.absolute) * volume)} ${delta.cost.absolute >= 0 ? "less" : "more"} / month`
                  : "Run an equivalent comparison"}
              </strong>
              <p>
                {delta.cost && jev?.comparison.usage && base?.comparison.usage
                  ? `${modelLabel(baseline)} ${money(base.comparison.usage.costUsd * volume)} · Jev ${money(jev.comparison.usage.costUsd * volume)}`
                  : "Projection uses measured per-run model costs."}
              </p>
              <small>
                Projected API spend at this workload. SuperDoc licensing,
                hosting, and human review excluded.
              </small>
            </div>
          </div>
          <details className="workflow-proof">
            <summary>
              Inspect comparison · timings, decisions & verification
            </summary>
            <p>
              Loaded document → final verification. Initialization, approval
              pauses, other lanes and export excluded. Optional reasoning is
              outside this controlled, approved-language workflow. {diff.length}{" "}
              decision locations differ across models. This run is a single
              observation, not a latency benchmark.
            </p>
            <div className="comparison-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Exact model</th>
                    <th>Extraction</th>
                    <th>Decision request</th>
                    <th>SuperDoc</th>
                    <th>Input / output / cached</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map(({ result: r }) => (
                    <tr key={r.model}>
                      <th>{r.model}</th>
                      <td>{seconds(r.timing.extractionMs)}</td>
                      <td>
                        {seconds(r.timing.decisionMs)}
                        <small>
                          Provider {seconds(r.comparison.elapsedMs)} within this
                        </small>
                      </td>
                      <td>{seconds(r.timing.executionMs)}</td>
                      <td>
                        {r.comparison.usage
                          ? `${r.comparison.usage.inputTokens} / ${r.comparison.usage.outputTokens} / ${r.comparison.usage.cachedInputTokens}`
                          : "Unknown"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Pricing {PRICING_DATE} · OpenAI reasoning none · No application
              cache, retries, or model substitutions.
            </p>
            {artifacts.map(({ result: r }) => (
              <details key={r.model}>
                <summary>
                  {modelLabel(r.model)} · actual decisions & operation receipts
                </summary>
                <pre>{JSON.stringify(r, null, 2)}</pre>
              </details>
            ))}
            <a
              href="https://github.com/jelkes1/superdoc-jev-demo/blob/main/docs/workflow-roi-methodology.md"
              target="_blank"
              rel="noreferrer"
            >
              Reproduce the evaluation and inspect the methodology ↗
            </a>
          </details>
        </>
      )}
      {preview && (
        <OutputPreview artifact={preview} close={() => setPreview(undefined)} />
      )}
      <div className="workflow-runtime" aria-hidden="true" inert ref={mount} />
    </section>
  );
}
function RecordedBenchmark() {
  const jev = benchmark.models[0],
    mini = benchmark.models[1];
  if (
    !benchmark.complete ||
    !jev.activeMs ||
    !mini.activeMs ||
    !jev.estimatedCostUsd ||
    !mini.estimatedCostUsd ||
    mini.equivalentToJev !== 5
  )
    return null;
  const time = reduction(mini.activeMs.median, jev.activeMs.median)!,
    cost = reduction(mini.estimatedCostUsd.mean, jev.estimatedCostUsd.mean)!;
  return (
    <aside className="recorded-benchmark">
      <div>
        <span className="eyebrow">RECORDED BENCHMARK · 5 RUNS PER MODEL</span>
        <b>Same 5 verified Word changes in every run</b>
        <small>Jev + SuperDoc versus GPT-5.4 mini + SuperDoc</small>
      </div>
      <div>
        <strong>{time.percent.toFixed(1)}% shorter</strong>
        <span>
          {seconds(mini.activeMs.median)} → {seconds(jev.activeMs.median)}{" "}
          median processing
        </span>
      </div>
      <div>
        <strong>{cost.percent.toFixed(1)}% lower cost</strong>
        <span>
          {money(mini.estimatedCostUsd.mean)} →{" "}
          {money(jev.estimatedCostUsd.mean)} per run
        </span>
      </div>
      <a
        href="https://github.com/jelkes1/superdoc-jev-demo/blob/main/docs/workflow-roi-methodology.md"
        target="_blank"
        rel="noreferrer"
      >
        Fictional sample · September 22, 2026 · Methodology ↗
      </a>
    </aside>
  );
}
export function WorkflowComparisonDialog({
  open,
  close,
}: {
  open: boolean;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="workflow-dialog"
      aria-label="Compare time and cost"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <header>
        <Brand />
        <button disabled={busy} onClick={close}>
          Return to your document
        </button>
      </header>
      <WorkflowComparison onBusyChange={setBusy} />
    </dialog>
  );
}
function OutputPreview({
  artifact,
  close,
}: {
  artifact: WorkflowArtifact;
  close: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let canceled = false;
    let dispose: (() => void) | undefined;
    void openCopy(mount.current!, artifact.blob!, true)
      .then((sd) => {
        dispose = () => sd.destroy();
        if (canceled) dispose();
      })
      .catch((e) => setError(e.message));
    return () => {
      canceled = true;
      dispose?.();
    };
  }, [artifact]);
  return (
    <section className="workflow-preview" aria-label="Comparison Word output">
      <div>
        <h4>
          {modelLabel(artifact.result.model)} + SuperDoc · exported Word output
        </h4>
        <button onClick={close}>Close preview</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="workflow-preview-document" ref={mount} />
    </section>
  );
}
