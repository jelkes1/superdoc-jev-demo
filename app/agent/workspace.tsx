"use client";
import { useEffect, useRef, useState } from "react";
import type { SuperDoc as Editor } from "superdoc";
import Brand from "../brand";
import Link from "next/link";
import ComparisonProof from "./comparison-proof";
import OutputPreview from "./output-preview";
import expectedFixture from "@/fixtures/agent/expected.json";
import { evaluateLane, type ExpectedCase } from "@/lib/agent/evaluation";
import {
  PRESETS,
  PIPELINES,
  LABELS,
  DRAFT_MODEL,
  SELECT_MODEL,
  totalCost,
  type Snapshot,
  type Pipeline,
  type Lane,
  type PlanResult,
} from "@/lib/agent/types";
import {
  documentIndex,
  decideEdit,
  guardExecution,
} from "@/lib/agent/document";
import {
  createEditor,
  transport,
  emptyLane,
  applyLane,
  download,
  fileHash,
  frozenCopy,
  assertSameContent,
  trackVisibility,
} from "@/lib/agent/browser";
import { listChanges } from "@/lib/review/document";
import "superdoc/style.css";
import "./workspace.css";
const money = (n: number | null) =>
  n === null ? "unavailable" : `$${n.toFixed(5)}`;
const seconds = (n: number) => `${(n / 1000).toFixed(2)}s`;
interface Comparison {
  id: string;
  file: File;
  snapshot: Snapshot;
  lanes: Lane[];
  outputs: Partial<Record<Pipeline, Blob>>;
  expected?: ExpectedCase;
}
export default function AgentWorkspace() {
  const mount = useRef<HTMLDivElement>(null),
    scratch = useRef<HTMLDivElement>(null),
    editor = useRef<Editor | null>(null),
    source = useRef<File | null>(null),
    sourceHash = useRef(""),
    cancel = useRef<AbortController | null>(null),
    generation = useRef(0),
    runId = useRef<string | null>(null);
  const [tab, setTab] = useState<"review" | "ai">("review"),
    [ready, setReady] = useState(false),
    [request, setRequest] = useState<string>(PRESETS[0].request),
    [pipeline, setPipeline] = useState<Pipeline>("jev"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [lane, setLane] = useState<Lane | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [revisions, setRevisions] = useState<
      { id: string; text: string; blockId?: string }[]
    >([]),
    [comments, setComments] = useState<{ id: string; text: string }[]>([]),
    [stale, setStale] = useState(false),
    [comparison, setComparison] = useState<Comparison | null>(null),
    [showComparison, setShowComparison] = useState(false),
    [activeComparison, setActiveComparison] = useState<Pipeline>("jev"),
    [comparisonApproval, setComparisonApproval] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [sessionResults, setSessionResults] = useState<PlanResult[]>([]);
  const [filename, setFilename] = useState("Fictional software agreement");
  const [sessionUnknown, setSessionUnknown] = useState(false);
  const initialRevision = useRef("");
  const [preview, setPreview] = useState<{
    blob: Blob;
    blockId?: string;
  } | null>(null);
  const lastCheck = useRef("");
  const doc = () => {
    const d = editor.current?.activeEditor?.doc;
    if (!d) throw new Error("The document is still loading.");
    return d;
  };
  const message = (e: unknown) =>
    e instanceof Error ? e.message : "The operation could not complete.";
  async function refreshReview() {
    const changes = await listChanges(doc());
    setRevisions(
      changes.map((c) => ({
        id: c.id,
        text:
          [c.deletedText, c.insertedText].filter(Boolean).join(" → ") || c.type,
        blockId: c.navigationTarget?.blockId,
      })),
    );
    const c = await doc().comments.list({ limit: 1000 });
    setComments(c.items.map((c) => ({ id: c.id, text: c.text ?? "Comment" })));
  }
  async function open(file?: File) {
    const ticket = ++generation.current;
    cancel.current?.abort();
    setBusy("Opening agreement");
    setReady(false);
    setError("");
    setLane(null);
    setSnapshot(null);
    setComparison(null);
    setShowComparison(false);
    lastCheck.current = "";
    setStale(false);
    setSessionResults([]);
    setSessionUnknown(false);
    try {
      const f =
        file ??
        new File(
          [await (await fetch("/agent-agreement.docx")).blob()],
          "fictional-software-agreement.docx",
        );
      if (f.size > 10 * 1024 * 1024 || !f.name.toLowerCase().endsWith(".docx"))
        throw new Error("Choose a text-based DOCX up to 10 MB.");
      source.current = f;
      setFilename(f.name);
      sourceHash.current = await fileHash(f);
      editor.current?.destroy();
      mount.current!.replaceChildren();
      document.getElementById("agent-toolbar")?.replaceChildren();
      const sd = await createEditor(mount.current!, f, "#agent-toolbar");
      if (ticket !== generation.current) {
        sd.destroy();
        return;
      }
      editor.current = sd;
      setReady(true);
      initialRevision.current = (await doc().info({})).revision;
      await refreshReview();
      if (import.meta.env.DEV)
        (window as unknown as { __agent: unknown }).__agent = {
          editor: sd,
          index: documentIndex,
          apply: applyLane,
        };
    } catch (e) {
      setError(message(e));
    } finally {
      if (ticket === generation.current) setBusy("");
    }
  }
  useEffect(() => {
    let gone = false;
    queueMicrotask(() => {
      if (!gone) void open();
    });
    return () => {
      gone = true;
      // This ref is a lifecycle counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      cancel.current?.abort();
      editor.current?.destroy();
    };
    // Intentionally one editor lifecycle; uploads use the explicit open handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      void Promise.resolve(doc().info({})).then((i) => {
        if (lastCheck.current)
          setStale(
            lastCheck.current !==
              JSON.stringify([i.revision, request, pipeline]),
          );
      });
    }, 1200);
    return () => clearInterval(t);
  }, [ready, request, pipeline]);
  async function jump(blockId?: string) {
    if (!blockId) return;
    await editor.current!.ui.viewport.scrollIntoView({
      target: { kind: "text", blockId, range: { start: 0, end: 0 } },
      block: "center",
      behavior: "instant",
    });
  }
  async function review() {
    if (!ready || busy) return;
    setError("");
    setNotice("");
    setTab("ai");
    setShowComparison(false);
    cancel.current = new AbortController();
    let id: string | undefined;
    let stopVisibility = () => {};
    try {
      const current = (await doc().info({})).revision,
        signature = JSON.stringify([current, request, pipeline]);
      if (signature === lastCheck.current) {
        setNotice("Nothing changed. No model call was made.");
        return;
      }
      setBusy("Checking document changes");
      if (lane && snapshot) {
        const pending = lane.executions.filter(
          (e) => e.status === "pending" && e.verified,
        );
        for (const e of pending) await guardExecution(doc(), snapshot, e);
        for (const e of pending) await decideEdit(doc(), snapshot, e, "reject");
      }
      const next = emptyLane(pipeline),
        t = performance.now();
      stopVisibility = trackVisibility(next);
      setBusy("Reading the document with SuperDoc");
      const s = await documentIndex(doc(), request, sourceHash.current);
      next.extractionMs = performance.now() - t;
      setSnapshot(s);
      setLane(next);
      const p = performance.now();
      const started = await transport.start(
        s,
        [pipeline],
        cancel.current.signal,
      );
      id = started.runId;
      runId.current = id;
      next.result = await transport.plan(
        s,
        id,
        pipeline,
        (e) => {
          if (e.type === "phase") setBusy(e.phase);
        },
        cancel.current.signal,
      );
      next.planningMs = performance.now() - p;
      stopVisibility();
      setLane({ ...next });
      setSelected(next.result.plan.edits.map((e) => e.id));
      setSessionResults((v) => [...v, next.result!]);
      lastCheck.current = JSON.stringify([s.revision, request, pipeline]);
      setStale(false);
      if (next.result.status === "failed")
        setError(next.result.error ?? "The pipeline could not complete.");
    } catch (e) {
      if (id) setSessionUnknown(true);
      setError(message(e));
    } finally {
      stopVisibility();
      if (id) await transport.finish(id).catch(() => {});
      runId.current = null;
      setBusy("");
      await refreshReview().catch(() => {});
    }
  }
  async function apply() {
    if (!lane || !snapshot) return;
    if (snapshot.request !== request || lane.pipeline !== pipeline) {
      setError("The request or approach changed. Recheck before applying.");
      return;
    }
    setBusy("Creating and verifying Word redlines");
    setError("");
    try {
      await applyLane(
        editor.current!,
        snapshot,
        { ...lane },
        selected,
        setLane,
      );
      lastCheck.current = JSON.stringify([
        (await doc().info({})).revision,
        request,
        pipeline,
      ]);
      setStale(false);
      setTab("review");
      await refreshReview();
      const first = lane.result?.plan.edits.find((e) =>
        selected.includes(e.id),
      );
      await jump(snapshot.blocks.find((b) => b.id === first?.blockId)?.nodeId);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  async function decide(index: number, decision: "accept" | "reject") {
    if (!lane || !snapshot) return;
    setBusy("Updating review");
    setError("");
    try {
      const edits = [...lane.executions];
      edits[index] = await decideEdit(doc(), snapshot, edits[index], decision);
      setLane({ ...lane, executions: edits });
      lastCheck.current = JSON.stringify([
        (await doc().info({})).revision,
        request,
        pipeline,
      ]);
      await refreshReview();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  async function exportWord() {
    try {
      const blob = await editor.current!.export({
        triggerDownload: false,
        commentsType: "external",
      });
      if (blob) download(blob, "superdoc-agent-reviewed.docx");
    } catch (e) {
      setError(message(e));
    }
  }
  async function compare() {
    if (busy || !ready) return;
    setBusy("Freezing the document and request");
    setError("");
    setTab("ai");
    setShowComparison(true);
    cancel.current = new AbortController();
    let id: string | undefined;
    try {
      const blob = await editor.current!.export({
        triggerDownload: false,
        commentsType: "external",
      });
      if (!blob) throw new Error("Could not freeze this document.");
      const file = new File([blob], "comparison.docx"),
        hash = await fileHash(file);
      const initial = await frozenCopy(file, scratch.current!, request, hash);
      const frozen = initial.snapshot;
      initial.editor.destroy();
      scratch.current!.replaceChildren();
      const isFixture =
        sourceHash.current === expectedFixture.documentHash &&
        (await doc().info({})).revision === initialRevision.current;
      const comp: Comparison = {
        id: crypto.randomUUID(),
        file,
        snapshot: frozen,
        lanes: PIPELINES.map(emptyLane),
        outputs: {},
        expected: isFixture
          ? expectedFixture.cases.find((c) => c.request === request)
          : undefined,
      };
      setComparison(comp);
      const started = await transport.start(
        frozen,
        [...PIPELINES],
        cancel.current.signal,
      );
      id = started.runId;
      runId.current = id;
      for (const p of PIPELINES) {
        if (cancel.current.signal.aborted) break;
        setBusy(`${LABELS[p]} · Reading independent copy`);
        const copy = await frozenCopy(file, scratch.current!, request, hash);
        const l = comp.lanes.find((l) => l.pipeline === p)!,
          stopVisibility = trackVisibility(l);
        try {
          assertSameContent(frozen, copy.snapshot);
          l.extractionMs = copy.extractionMs;
          const t = performance.now();
          l.result = await transport.plan(
            frozen,
            id,
            p,
            (e) => {
              if (e.type === "phase") setBusy(`${LABELS[p]} · ${e.phase}`);
            },
            cancel.current.signal,
          );
          l.planningMs = performance.now() - t;

          setComparison({ ...comp, lanes: [...comp.lanes] });
        } finally {
          stopVisibility();
          copy.editor.destroy();
          scratch.current!.replaceChildren();
        }
      }
      setActiveComparison("jev");
      setComparisonApproval(
        comp.lanes
          .find((l) => l.pipeline === "jev")
          ?.result?.plan.edits.map((e) => e.id) ?? [],
      );
    } catch (e) {
      setError(message(e));
    } finally {
      if (id) await transport.finish(id).catch(() => {});
      runId.current = null;
      setBusy("");
    }
  }
  async function applyComparison() {
    if (!comparison) return;
    const l = comparison.lanes.find((l) => l.pipeline === activeComparison);
    if (!l?.result || l.executions.length) return;
    setBusy("Creating redlines in the comparison copy");
    setError("");
    try {
      const copy = await frozenCopy(
        comparison.file,
        scratch.current!,
        comparison.snapshot.request,
        comparison.snapshot.documentHash,
      );
      try {
        assertSameContent(comparison.snapshot, copy.snapshot);
        await applyLane(copy.editor, copy.snapshot, l, comparisonApproval);
        if (comparison.expected) {
          const checked = evaluateLane(copy.snapshot, l, comparison.expected);
          l.expectedOutcome = checked.agreement;
          l.requiredCoverage = checked.coverage;
        }
        const blob = await copy.editor.export({
          triggerDownload: false,
          commentsType: "external",
        });
        if (blob) comparison.outputs[l.pipeline] = blob;
        setComparison({ ...comparison, lanes: [...comparison.lanes] });
      } finally {
        copy.editor.destroy();
        scratch.current!.replaceChildren();
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy("");
    }
  }
  const active = showComparison
      ? comparison?.lanes.find((l) => l.pipeline === activeComparison)
      : lane,
    plan = active?.result?.plan;
  const picked = showComparison ? comparisonApproval : selected,
    setPicked = showComparison ? setComparisonApproval : setSelected;
  const verified =
    lane?.executions.filter((e) => e.verified && e.edit.tool === "replace")
      .length ?? 0;
  const updateRequest = (value: string) => {
    setRequest(value);
    setTab("ai");
    setShowComparison(false);
    setNotice("");
  };
  return (
    <main className="agent-app">
      <header className="agent-header">
        <Brand />
        <nav>
          <Link href="/">Playbook demo</Link>
          <a href="/agent/results">Evaluation</a>
          <a
            href="https://github.com/jelkes1/superdoc-jev-demo"
            target="_blank"
            rel="noreferrer"
          >
            Get the code ↗
          </a>
          <label className="agent-upload">
            Open DOCX
            <input
              aria-label="Open DOCX"
              type="file"
              accept=".docx"
              disabled={!!busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void open(f);
                e.target.value = "";
              }}
            />
          </label>
          <button disabled={!ready || !!busy} onClick={exportWord}>
            Download Word
          </button>
        </nav>
      </header>
      <section className="agent-intro">
        <div>
          <span className="agent-eyebrow">DOCUMENT AGENT</span>
          <h1>A request. The right context. Real Word changes.</h1>
          <p>
            SuperDoc reads and edits the document. Jev selects context. The LLM
            drafts for your approval.
          </p>
        </div>
        <div className="agent-preset-row">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              disabled={!!busy}
              onClick={() => updateRequest(p.request)}
            >
              {p.label} ↗
            </button>
          ))}
        </div>
      </section>
      <div className="agent-stage" aria-label="Workflow progress">
        {[
          "Understand request",
          "Find relevant content",
          "Propose changes",
          "Review redlines",
        ].map((s, i) => (
          <span
            key={s}
            className={
              (verified ? i === 3 : plan ? i === 2 : busy ? i === 1 : i === 0)
                ? "active"
                : ""
            }
          >
            <b>{i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      {error && (
        <div role="alert" className="agent-alert">
          {error}{" "}
          <button disabled={!!busy} onClick={() => void review()}>
            Recheck request
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="agent-notice">
          {notice}
        </p>
      )}
      <div className="agent-workspace">
        <section className="agent-document">
          <div className="agent-document-label">
            <span>{filename}</span>
            <span>Existing counsel revisions preserved</span>
          </div>
          <div id="agent-toolbar" />
          <div className="agent-document-scroll">
            <div ref={mount} />
          </div>
        </section>
        <aside className="agent-sidebar">
          <div
            className="agent-tabs"
            role="tablist"
            aria-label="Document sidebar"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                setTab(tab === "review" ? "ai" : "review");
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                buttons[tab === "review" ? 1 : 0]?.focus();
              }
            }}
          >
            <button
              role="tab"
              tabIndex={tab === "review" ? 0 : -1}
              aria-selected={tab === "review"}
              onClick={() => setTab("review")}
            >
              Review <span>{revisions.length}</span>
            </button>
            <button
              role="tab"
              tabIndex={tab === "ai" ? 0 : -1}
              aria-selected={tab === "ai"}
              onClick={() => setTab("ai")}
            >
              AI
            </button>
          </div>
          <div className="agent-panel" role="tabpanel">
            {tab === "review" ? (
              <>
                <h2>Review the Word changes</h2>
                <p className="agent-muted">
                  The sample already includes counsel’s payment and liability
                  revisions. Choose a request above to add your own.
                </p>
                {lane?.executions.map((e, i) => (
                  <article className="agent-card" key={e.edit.id}>
                    <button
                      className="agent-text-button"
                      onClick={() =>
                        jump(
                          snapshot?.blocks.find((b) => b.id === e.edit.blockId)
                            ?.nodeId,
                        )
                      }
                    >
                      {e.edit.explanation}
                    </button>
                    <span className={e.verified ? "agent-good" : "agent-bad"}>
                      {e.verified
                        ? e.edit.tool === "replace"
                          ? "Verified tracked edit"
                          : "Verified anchored comment"
                        : "Needs inspection"}{" "}
                      · {e.status}
                    </span>
                    {e.error && <p>{e.error}</p>}
                    {e.status === "pending" && e.verified && (
                      <div className="agent-actions">
                        <button
                          disabled={!!busy}
                          onClick={() => decide(i, "accept")}
                        >
                          Accept
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => decide(i, "reject")}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() =>
                            jump(
                              snapshot?.blocks.find(
                                (b) =>
                                  b.id ===
                                  lane.executions[
                                    (i + 1) % lane.executions.length
                                  ]?.edit.blockId,
                              )?.nodeId,
                            )
                          }
                        >
                          Next change
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {revisions
                  .filter(
                    (r) =>
                      !lane?.executions.some((e) => e.changeIds.includes(r.id)),
                  )
                  .map((r) => (
                    <article key={r.id} className="agent-card agent-existing">
                      <small>DOCUMENT REVISION</small>
                      <button
                        className="agent-text-button"
                        onClick={() => jump(r.blockId)}
                      >
                        {r.text}
                      </button>
                    </article>
                  ))}
                {comments.map((c) => (
                  <article key={c.id} className="agent-card">
                    <small>COMMENT</small>
                    <p>{c.text}</p>
                  </article>
                ))}
                {lane?.result?.plan.unresolved.map((u, i) => (
                  <p className="agent-alert" key={i}>
                    Unresolved: {u}
                  </p>
                ))}
                <button
                  className="agent-primary"
                  disabled={!ready || !!busy}
                  onClick={() => setTab("ai")}
                >
                  Make a document request
                </button>
              </>
            ) : (
              <>
                <label className="agent-field">
                  What should change?
                  <textarea
                    value={request}
                    maxLength={2000}
                    disabled={!!busy}
                    onChange={(e) => updateRequest(e.target.value)}
                  />
                </label>
                <div className="agent-actions">
                  <button
                    className="agent-primary"
                    disabled={!ready || !!busy || !request.trim()}
                    onClick={review}
                  >
                    {stale ? "Recheck changed document" : "Propose changes"}
                  </button>
                  <button disabled={!ready || !!busy} onClick={compare}>
                    Compare approaches
                  </button>
                </div>
                <details className="agent-support">
                  <summary>Approach & data</summary>
                  <label>
                    Pipeline
                    <select
                      value={pipeline}
                      disabled={!!busy}
                      onChange={(e) => setPipeline(e.target.value as Pipeline)}
                    >
                      {PIPELINES.map((p) => (
                        <option value={p} key={p}>
                          {LABELS[p]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    Extracted text is processed by TypeSafe for Jev selection
                    and by OpenAI for drafting. Contents are not retained by
                    this application. Five runs per hour; $10/day shared model
                    allowance. English DOCX, 10 MB and 25,000 tokens maximum.
                  </p>
                  <p>
                    Supported changes: tracked text replacements and anchored
                    comments. Document coverage excludes headers, footers, text
                    boxes and images.
                  </p>
                </details>
                {busy && (
                  <div className="agent-progress" role="status">
                    <span className="agent-spinner" />
                    {busy}
                    <button
                      onClick={() => {
                        cancel.current?.abort();
                        if (runId.current) void transport.finish(runId.current);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {comparison && (
                  <div className="agent-comparison">
                    <div className="agent-actions">
                      <button onClick={() => setShowComparison(false)}>
                        Your document
                      </button>
                      <button onClick={() => setShowComparison(true)}>
                        Comparison copies
                      </button>
                    </div>
                    {showComparison && (
                      <>
                        <h3>Same request. Same drafting model.</h3>
                        <ComparisonProof
                          key={comparison.id}
                          lanes={comparison.lanes}
                          fixture={!!comparison.expected}
                        />
                        <p className="agent-muted">
                          Each approach uses its own Word copy. Your working
                          document stays unchanged.
                        </p>
                        <div className="agent-lane-tabs">
                          {["jev", "full"].map((p) => (
                            <button
                              key={p}
                              aria-pressed={activeComparison === p}
                              onClick={() => {
                                setActiveComparison(p as Pipeline);
                                setComparisonApproval(
                                  comparison.lanes
                                    .find((l) => l.pipeline === p)
                                    ?.result?.plan.edits.map((e) => e.id) ?? [],
                                );
                              }}
                            >
                              {LABELS[p as Pipeline]}
                            </button>
                          ))}
                        </div>
                        <details>
                          <summary>Inspect comparison</summary>
                          <select
                            aria-label="Comparison pipeline"
                            value={activeComparison}
                            onChange={(e) => {
                              const p = e.target.value as Pipeline;
                              setActiveComparison(p);
                              setComparisonApproval(
                                comparison.lanes
                                  .find((l) => l.pipeline === p)
                                  ?.result?.plan.edits.map((e) => e.id) ?? [],
                              );
                            }}
                          >
                            {PIPELINES.map((p) => (
                              <option key={p} value={p}>
                                {LABELS[p]}
                              </option>
                            ))}
                          </select>
                          <table>
                            <thead>
                              <tr>
                                <th>Approach</th>
                                <th>Status</th>
                                <th>Processing</th>
                                <th>Model cost</th>
                                <th>Word edits</th>
                              </tr>
                            </thead>
                            <tbody>
                              {comparison.lanes.map((l) => (
                                <tr key={l.pipeline}>
                                  <td>{LABELS[l.pipeline]}</td>
                                  <td>{l.result?.status ?? "Not completed"}</td>
                                  <td>
                                    {l.timingValid
                                      ? seconds(
                                          l.extractionMs +
                                            l.planningMs +
                                            l.executionMs,
                                        )
                                      : "timing unavailable"}
                                    {!l.result
                                      ? " · not completed"
                                      : !l.executions.length
                                        ? " · planning"
                                        : ""}
                                  </td>
                                  <td>{money(totalCost(l.result))}</td>
                                  <td>
                                    {
                                      l.executions.filter((e) => e.verified)
                                        .length
                                    }
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      </>
                    )}
                  </div>
                )}
                {active?.result && (
                  <>
                    <div className="agent-proof">
                      <small>
                        {showComparison ? LABELS[active.pipeline] : "THIS RUN"}
                      </small>
                      <strong>
                        {
                          active.executions.filter(
                            (e) => e.verified && e.edit.tool === "replace",
                          ).length
                        }{" "}
                        verified Word changes
                      </strong>
                      <div>
                        {active.timingValid
                          ? seconds(
                              active.extractionMs +
                                active.planningMs +
                                active.executionMs,
                            )
                          : "Timing unavailable"}{" "}
                        processing · {money(totalCost(active.result))} estimated
                        model spend
                      </div>
                      <p>
                        {active.result.contextTokens.toLocaleString()} /{" "}
                        {active.result.fullContextTokens.toLocaleString()}{" "}
                        context tokens sent to drafting
                      </p>
                      {active.result.selection.fallback && (
                        <p>{active.result.selection.fallback}</p>
                      )}
                      <details>
                        <summary>Inspect proof</summary>
                        <p>
                          {SELECT_MODEL} · {DRAFT_MODEL} · reasoning: none
                        </p>
                        <p>
                          First verified edit:{" "}
                          {!active.timingValid
                            ? "unavailable (page backgrounded)"
                            : active.firstVerifiedMs === null
                              ? "pending"
                              : seconds(active.firstVerifiedMs)}
                          . Human approval time is excluded.
                        </p>
                        <p>
                          Operation schema tokens: {active.result.toolTokens} /{" "}
                          {active.result.fullToolTokens}. Tools:{" "}
                          {active.result.selection.tools.join(", ")}
                        </p>
                        <pre>
                          {JSON.stringify(
                            {
                              snapshot: active.result.snapshot,
                              interpretation: active.result.interpretation,
                              originalRequest: (showComparison
                                ? comparison?.snapshot
                                : snapshot
                              )?.request,
                              registryVersion: (showComparison
                                ? comparison?.snapshot
                                : snapshot
                              )?.registryVersion,
                              phases: active.result.phases,
                              browserTiming: {
                                extractionMs: active.extractionMs,
                                planningMs: active.planningMs,
                                executionMs: active.executionMs,
                                firstVerifiedMs: active.firstVerifiedMs,
                                timingValid: active.timingValid,
                              },
                              usage: active.result.usage,
                              execution: active.executions,
                            },
                            null,
                            2,
                          )}
                        </pre>
                        <a href="https://github.com/jelkes1/superdoc-jev-demo/tree/codex/superdoc-jev-demo/lib/agent">
                          Reuse this integration ↗
                        </a>
                      </details>
                    </div>
                    <p className="agent-muted">
                      {active.executions.length} attempted · {active.failed}{" "}
                      failed ·{" "}
                      {(plan?.edits.length ?? 0) - active.executions.length}{" "}
                      unapplied proposals · {plan?.unresolved.length ?? 0}{" "}
                      unresolved
                    </p>
                    <h3>{plan?.summary || "Pipeline result"}</h3>
                    {plan?.clarification && (
                      <div className="agent-clarification">
                        <h3>One detail before drafting</h3>
                        <p>{plan.clarification}</p>
                        {plan.choices.map((c) => (
                          <button
                            key={c}
                            disabled={!!busy}
                            onClick={() =>
                              updateRequest(
                                `${request}\nScope clarification: ${c}`.slice(
                                  0,
                                  2000,
                                ),
                              )
                            }
                          >
                            {c}
                          </button>
                        ))}
                        <p>Select a scope, then propose changes again.</p>
                      </div>
                    )}
                    <details className="agent-support">
                      <summary>
                        Selected document context (
                        {active.result.selection.ids.length} passages)
                      </summary>
                      {active.result.selection.ids.map((id) => {
                        const b = (
                          showComparison ? comparison?.snapshot : snapshot
                        )?.blocks.find((b) => b.id === id);
                        return b ? (
                          <button
                            className="agent-context"
                            key={id}
                            onClick={() =>
                              showComparison && comparison
                                ? setPreview({
                                    blob:
                                      comparison.outputs[activeComparison] ??
                                      comparison.file,
                                    blockId: b.id,
                                  })
                                : jump(b.nodeId)
                            }
                          >
                            <b>{b.title}</b>
                            <span>{b.text.slice(0, 190)}…</span>
                          </button>
                        ) : null;
                      })}
                      <details>
                        <summary>Native Jev decisions</summary>
                        <pre>
                          {JSON.stringify(
                            active.result.selection.decisions,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </details>
                    {plan?.edits.map((e) => (
                      <article className="agent-proposal" key={e.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={picked.includes(e.id)}
                            disabled={!!busy || active.executions.length > 0}
                            onChange={(v) =>
                              setPicked(
                                v.target.checked
                                  ? [...picked, e.id]
                                  : picked.filter((id) => id !== e.id),
                              )
                            }
                          />
                          {e.explanation}
                        </label>
                        <small className="agent-operation-label">
                          {e.tool === "comment"
                            ? "ANCHORED COMMENT · SOURCE PASSAGE"
                            : "TRACKED TEXT REPLACEMENT"}
                        </small>
                        <div
                          className={
                            e.tool === "comment"
                              ? "agent-anchor"
                              : "agent-before"
                          }
                        >
                          {e.original}
                        </div>
                        <div className="agent-after">{e.replacement}</div>
                      </article>
                    ))}
                    {plan?.unresolved.map((u, i) => (
                      <p className="agent-alert" key={i}>
                        {u}
                      </p>
                    ))}
                    {!!plan?.edits.length && !active.executions.length && (
                      <button
                        className="agent-primary"
                        disabled={
                          !!busy ||
                          !picked.length ||
                          (!showComparison &&
                            (stale ||
                              snapshot?.request !== request ||
                              lane?.pipeline !== pipeline))
                        }
                        onClick={showComparison ? applyComparison : apply}
                      >
                        Approve selected language & create redlines
                      </button>
                    )}
                    {!plan?.edits.length && !plan?.clarification && (
                      <p className="agent-muted">
                        No executable proposals. Edit the request, try another
                        approach, or continue reviewing and export.
                      </p>
                    )}
                    {showComparison &&
                      comparison?.outputs[activeComparison] && (
                        <>
                          <button
                            onClick={() =>
                              setPreview({
                                blob: comparison.outputs[activeComparison]!,
                              })
                            }
                          >
                            Inspect this Word copy
                          </button>
                          <button
                            onClick={() =>
                              download(
                                comparison.outputs[activeComparison]!,
                                `superdoc-agent-${activeComparison}.docx`,
                              )
                            }
                          >
                            Download this comparison Word file
                          </button>
                        </>
                      )}
                    {!showComparison && active.executions.length > 0 && (
                      <button
                        className="agent-primary"
                        onClick={() => setTab("review")}
                      >
                        Review redlines
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <footer className="agent-footer">
            {verified} verified ·{" "}
            {lane?.executions.filter((e) => e.status === "accepted").length ??
              0}{" "}
            accepted ·{" "}
            {lane?.executions.filter((e) => e.status === "rejected").length ??
              0}{" "}
            rejected ·{" "}
            {lane?.executions.filter((e) => e.status === "pending").length ?? 0}{" "}
            pending · {lane?.result?.plan.unresolved.length ?? 0} unresolved
            {(sessionUnknown || sessionResults.length > 1) && (
              <div>
                Session model spend:{" "}
                {sessionUnknown ||
                sessionResults.some((r) => totalCost(r) === null)
                  ? "unavailable"
                  : money(
                      sessionResults.reduce(
                        (n, r) => n + (totalCost(r) ?? 0),
                        0,
                      ),
                    )}
              </div>
            )}
          </footer>
        </aside>
      </div>
      {preview && (
        <OutputPreview {...preview} onClose={() => setPreview(null)} />
      )}
      <div ref={scratch} className="agent-scratch" aria-hidden="true" />
    </main>
  );
}
