"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Proposal, Usage } from "@/lib/review/types";
import type { SuperDoc as Editor } from "superdoc";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Download,
  FileText,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Table2,
  X,
  GitPullRequest,
  MessageSquare,
  AlertTriangle,
  Play,
  Upload,
} from "lucide-react";
import {
  RULES,
  DEFAULT_POLICY,
  VERSION,
  requirement,
  type Policy,
  type RuleId,
  type Review,
  type Decision,
} from "@/lib/deal-desk/rules";
import {
  readDocument,
  signature,
  eligible,
  applyOperation,
  decideOperation,
  clearOwned,
  type Reading,
  type Operation,
  type Row,
} from "@/lib/deal-desk/document";

declare global {
  interface Window {
    __dealDesk?: {
      instance: Editor;
      read: typeof readDocument;
      apply: typeof applyOperation;
      decide: typeof decideOperation;
      clear: typeof clearOwned;
    };
  }
}
const msg = (e: unknown) =>
  e instanceof Error ? e.message : "The action could not be completed.";
const percent = (x: number) => `${(x * 100).toFixed(1)}%`;
type Cache = { decision: Decision; signature: string };
export default function DealDesk() {
  const mount = useRef<HTMLDivElement>(null),
    instance = useRef<Editor | null>(null),
    generation = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY),
    [reading, setReading] = useState<Reading | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [cache, setCache] = useState<Partial<Record<RuleId, Cache>>>({}),
    [ops, setOps] = useState<Operation[]>([]),
    [selected, setSelected] = useState<RuleId>("training"),
    [tab, setTab] = useState<"document" | "matrix" | "developer">("document"),
    [changed, setChanged] = useState<RuleId[]>([]),
    [stale, setStale] = useState(false),
    [source, setSource] = useState("Meridian’s returned agreement"),
    [consent, setConsent] = useState(false),
    [reused, setReused] = useState(0),
    [lastCheck, setLastCheck] = useState(""),
    [humanText, setHumanText] = useState(""),
    [editing, setEditing] = useState(false);
  const [reasoning, setReasoning] = useState<Review["reasoning"]>();
  const [reasoned, setReasoned] = useState<{
    proposal: Proposal | null;
    explanation: string;
    usage: Usage;
    model: string;
  }>();
  const doc = () => {
    const d = instance.current?.activeEditor?.doc;
    if (!d) throw new Error("The document is loading.");
    return d;
  };
  async function open(file?: File | string) {
    const ticket = ++generation.current;
    setReady(false);
    setError("");
    setReview(null);
    setCache({});
    setOps([]);
    setReading(null);
    setStale(false);
    setChanged([]);
    setEditing(false);
    setPolicy(DEFAULT_POLICY);
    setLastCheck("");
    setConsent(false);
    setReasoning(undefined);
    setReasoned(undefined);
    try {
      const { SuperDoc } = await import("superdoc");
      if (ticket !== generation.current) return;
      instance.current?.destroy();
      mount.current!.replaceChildren();
      document.getElementById("desk-toolbar")?.replaceChildren();
      const sd = new SuperDoc({
        selector: mount.current!,
        document: file ?? "/deal-desk.docx",
        documentMode: "editing",
        role: "editor",
        user: {
          name: "Northstar · Document agent",
          email: "agent@example.invalid",
        },
        ui: {
          toolbar: { container: "#desk-toolbar", responsiveToContainer: true },
          comments: { layout: "inline" },
          search: true,
          ruler: false,
        },
        zoom: {
          mode: "fit-width",
          fitWidth: { min: 25, max: 110, padding: 30 },
        },
        onReady: () => {
          void readDocument(sd.activeEditor!.doc!, DEFAULT_POLICY)
            .then((r) => {
              if (ticket === generation.current) {
                setReading(r);
                setReady(true);
              }
            })
            .catch((e) => setError(msg(e)));
        },
        onException: () =>
          setError(
            "The editor reported an issue. Reopen the sample if editing is unavailable.",
          ),
      });
      instance.current = sd;
      if (import.meta.env.DEV)
        window.__dealDesk = {
          instance: sd,
          read: readDocument,
          apply: applyOperation,
          decide: decideOperation,
          clear: clearOwned,
        };
    } catch (e) {
      setError(msg(e));
    }
  }
  /* eslint-disable react-hooks/exhaustive-deps -- One editor lifecycle and explicit snapshot refreshes. */
  useEffect(() => {
    let canceled = false;
    queueMicrotask(() => {
      if (!canceled) void open();
    });
    return () => {
      canceled = true;
      generation.current++;
      instance.current?.destroy();
      delete window.__dealDesk;
    };
  }, []);
  useEffect(() => {
    if (!ready || busy || !reading) return;
    let canceled = false;
    const t = setInterval(() => {
      void Promise.resolve(doc().info({}))
        .then(async (info) => {
          if (info.revision === reading.revision) return;
          const fresh = await readDocument(doc(), policy);
          if (canceled) return;
          const dirty = fresh.rows
            .filter(
              (r) =>
                cache[r.id] && cache[r.id]!.signature !== signature(r, policy),
            )
            .map((r) => r.id);
          setChanged(dirty);
          setStale(true);
          setReading(fresh);
        })
        .catch(() => {});
    }, 1200);
    return () => {
      canceled = true;
      clearInterval(t);
    };
  }, [ready, busy, reading, cache, policy]);
  /* eslint-enable react-hooks/exhaustive-deps */
  async function navigate(id: RuleId) {
    setSelected(id);
    setTab("document");
    setEditing(false);
    const row = reading?.rows.find((x) => x.id === id);
    if (row?.clause) {
      const r = await instance.current!.ui.viewport.scrollIntoView({
        target: {
          kind: "text",
          blockId: row.clause.nodeId,
          range: { start: 0, end: 0 },
        },
        block: "center",
        behavior: "instant",
      });
      if (!r.success) setError("This target moved. Recheck the document.");
    }
  }
  async function check() {
    if (busy || !consent) return;
    setBusy("Reading current document targets…");
    setError("");
    try {
      const fresh = await readDocument(doc(), policy);
      const pending = fresh.rows.filter(
        (r) =>
          !r.problem &&
          r.clause &&
          cache[r.id]?.signature !== signature(r, policy),
      );
      const kept = fresh.rows.length - pending.length;
      setReading(fresh);
      setReused(kept);
      if (!pending.length) {
        setStale(false);
        setChanged([]);
        setLastCheck(
          "All available decisions are still current. No model call needed.",
        );
        return;
      }
      setBusy(`Jev is checking ${pending.length} changed locations…`);
      const response = await fetch("/api/deal-desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: fresh.revision,
          version: VERSION,
          policy,
          rows: pending.map((r) => ({
            id: r.id,
            text: r.clause!.text,
            context: r.context,
          })),
        }),
      });
      const data = (await response.json()) as Review & { error?: string };
      if (!response.ok) throw new Error(data.error);
      const result = data as Review;
      if (
        result.revision !== fresh.revision ||
        result.version !== VERSION ||
        result.decisions.length !== pending.length
      )
        throw new Error("The review response did not match this document.");
      const next = { ...cache };
      for (const decision of result.decisions) {
        const row = pending.find((r) => r.id === decision.id);
        if (!row) throw new Error("Unexpected decision row.");
        next[decision.id] = { decision, signature: signature(row, policy) };
      }
      setCache(next);
      setReview(result);
      if (result.reasoning) setReasoning(result.reasoning);
      const now = await readDocument(doc(), policy);
      setReading(now);
      setStale(now.revision !== fresh.revision);
      setChanged(
        now.rows
          .filter(
            (r) => next[r.id] && next[r.id]!.signature !== signature(r, policy),
          )
          .map((r) => r.id),
      );
      setLastCheck(
        `${result.decisions.length} live Jev decisions · ${kept} unchanged locations reused`,
      );
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function apply(id: RuleId, human = false) {
    if (busy || !reading) return;
    setBusy("SuperDoc is proposing and verifying the redline…");
    setError("");
    try {
      const op = await applyOperation(
        doc(),
        reading,
        id,
        policy,
        cache[id]?.decision,
        human,
      );
      setOps((s) => [
        ...s.filter((o) => o.id !== id || o.status !== "pending"),
        op,
      ]);
      if (!op.verified)
        throw new Error(
          "The edit was applied but did not pass verification. Inspect it manually.",
        );
      setReading(await readDocument(doc(), policy));
      setStale(true);
      setChanged((s) => [...new Set([...s, id])]);
      await navigate(id);
      if (op.warning) setError(op.warning);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function applyReady(humanApproved = false) {
    if (!reading || busy) return;
    setBusy("Proposing the eligible changes…");
    setError("");
    try {
      let current = reading;
      const ids = current.rows
        .filter(
          (r) =>
            (humanApproved
              ? canApprove(r)
              : eligible(r, cache[r.id]?.decision) &&
                cache[r.id]?.signature === signature(r, policy)) &&
            !ops.some((o) => o.id === r.id && o.status === "pending"),
        )
        .map((r) => r.id);
      if ((await doc().info({})).revision !== current.revision)
        throw new Error("The document changed. Recheck before applying.");
      for (const id of ids) {
        const op = await applyOperation(
          doc(),
          current,
          id,
          policy,
          cache[id]?.decision,
          humanApproved,
        );
        setOps((s) => [...s, op]);
        if (!op.verified)
          throw new Error(
            "A proposed edit did not pass verification. Inspect it before continuing.",
          );
        current = await readDocument(doc(), policy);
      }
      setReading(current);
      setStale(true);
      setChanged(ids);
      setSelected("training");
      setTab("document");
      await instance.current!.ui.viewport.scrollIntoView({
        target: {
          kind: "text",
          blockId: current.rows.find((r) => r.id === "training")!.clause!.id,
          range: { start: 0, end: 0 },
        },
        block: "center",
        behavior: "instant",
      });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function decide(op: Operation, choice: "accept" | "reject") {
    setBusy("Saving your review decision…");
    setError("");
    try {
      const updated = await decideOperation(doc(), op, choice);
      setOps((s) => s.map((o) => (o === op ? updated : o)));
      setReading(await readDocument(doc(), policy));
      setStale(true);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function changeTerms(next: Policy) {
    if (busy) return;
    setBusy("Checking ownership of pending suggestions…");
    setError("");
    try {
      await clearOwned(doc(), ops);
      setOps((s) =>
        s.map((o) =>
          o.status === "pending" ? { ...o, status: "rejected" } : o,
        ),
      );
      setPolicy(next);
      setReading(await readDocument(doc(), next));
      setStale(true);
      setChanged(RULES.map((r) => r.id));
      setLastCheck(
        "Agreed terms changed. Recheck the current document; accepted changes remain.",
      );
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function editClause() {
    if (!reading) return;
    const row = reading.rows.find((r) => r.id === selected);
    if (!row?.clause) return;
    setBusy("Saving your counter-edit into the document…");
    setError("");
    try {
      const revision = (await doc().info({})).revision;
      const q = await doc().query.match({
        select: { type: "text", pattern: row.clause.text, caseSensitive: true },
        within: {
          kind: "block",
          nodeType: row.clause.nodeType,
          nodeId: row.clause.id,
        },
        require: "exactlyOne",
      });
      if (q.items[0]?.matchKind !== "text")
        throw new Error("The target changed.");
      const r = await doc().replace(
        { target: q.items[0].target, text: humanText },
        { changeMode: "direct", expectedRevision: revision },
      );
      if (!r.success)
        throw new Error(r.failure?.message ?? "The edit could not be applied.");
      setReading(await readDocument(doc(), policy));
      setStale(true);
      setChanged((s) => [...new Set([...s, selected])]);
      setEditing(false);
      setLastCheck(
        "Your counter-edit changed the actual DOCX. Its prior decision is now stale.",
      );
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function requestDraft() {
    if (!reasoning || busy) return;
    setBusy("Reasoning model is drafting for human review…");
    setError("");
    try {
      const fresh = await readDocument(doc(), policy);
      const signal = fresh.rows.find((r) => r.id === "signals");
      if (
        signal?.clause?.text !== reasoning.clause.text ||
        signal?.context !== reasoning.clause.context ||
        policy.training !== "consent"
      )
        throw new Error(
          "This clause or its policy changed. Recheck before drafting.",
        );
      const res = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: reasoning.reviewId,
          reasonToken: reasoning.token,
          clause: reasoning.clause,
          ruleId: "data",
          playbook: reasoning.playbook,
        }),
      });
      const result = (await res.json()) as {
        proposal: Proposal | null;
        explanation: string;
        usage: Usage;
        model: string;
        error?: string;
      };
      if (!res.ok) throw new Error(result.error);
      setReasoned(result);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function proposeDraft() {
    if (!reasoned?.proposal || busy || !reading) return;
    setBusy("Proposing your approved draft…");
    setError("");
    try {
      const row = reading.rows.find((r) => r.id === "signals");
      if (
        row?.clause?.text !== reasoned.proposal.original ||
        policy.training !== "consent"
      )
        throw new Error("The clause or policy changed. Request a fresh draft.");
      const result = await applyOperation(
        doc(),
        reading,
        "signals",
        policy,
        cache.signals?.decision,
        true,
        reasoned.proposal.replacement,
      );
      setOps((s) => [...s, result]);
      setReading(await readDocument(doc(), policy));
      setStale(true);
      if (!result.verified)
        throw new Error("Inspect the draft: verification did not pass.");
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  async function download() {
    setBusy("Exporting the reviewed DOCX…");
    try {
      await instance.current!.export({
        triggerDownload: true,
        exportedName: "northstar-reviewed-agreement",
      });
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  }
  function canApprove(r: Row) {
    return (
      RULES.find((x) => x.id === r.id)?.kind === "replace" &&
      !!cache[r.id] &&
      !r.problem &&
      !!r.clause &&
      !!r.replacement &&
      r.replacement !== r.clause.text &&
      !r.existing.length &&
      !ops.some((o) => o.id === r.id && o.status === "pending")
    );
  }
  function currentDecision(r: Row) {
    const c = cache[r.id];
    return c && c.signature === signature(r, policy) ? c.decision : undefined;
  }
  function state(r: Row) {
    const op = ops.findLast((o) => o.id === r.id);
    if (op?.status === "pending") return "Redline ready";
    if (r.problem) return "Needs context";
    if (cache[r.id] && !currentDecision(r)) return "Recheck";
    if (!currentDecision(r)) return "Not checked";
    if (r.id === "payment") return "Preserve";
    if (r.id === "liability" || r.id === "signals") return "Human decision";
    if (r.id === "safeguard" && !r.present) return "Approve insertion";
    const d = currentDecision(r)!;
    if (d.verdict === "ACCEPTABLE") return "Aligned";
    if (eligible(r, d)) return "Ready to redline";
    return "Human decision";
  }
  const row = reading?.rows.find((r) => r.id === selected),
    rule = RULES.find((r) => r.id === selected)!,
    decision = row ? currentDecision(row) : undefined,
    previous = cache[selected]?.decision,
    op = ops.findLast((o) => o.id === selected),
    pending = ops.filter((o) => o.status === "pending"),
    eligibleCount =
      reading?.rows.filter(
        (r) =>
          eligible(r, currentDecision(r)) &&
          !pending.some((o) => o.id === r.id),
      ).length ?? 0;
  const approvalRows = reading?.rows.filter(canApprove) ?? [];
  return (
    <div className="deal-app">
      <header className="deal-header">
        <Link href="/" className="deal-brand">
          <span className="deal-logo">
            <FileText size={19} />
          </span>
          SuperDoc <span className="muted">×</span> Jev{" "}
          <span className="release-pill">DEAL DESK · V3</span>
        </Link>
        <nav>
          <Link href="/walkthrough">
            How it works <ArrowUpRight size={14} />
          </Link>
          <a
            href="https://github.com/jelkes1/superdoc-jev-demo"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={15} /> Get the code
          </a>
        </nav>
      </header>
      <section className="deal-title">
        <div>
          <span className="eyebrow">A NEGOTIATION ALREADY IN PROGRESS</span>
          <h1>From agreed terms to a Word counterproposal.</h1>
          <p>
            Implement the deal. Keep counsel’s work. Leave the judgment calls to
            a human.
          </p>
        </div>
        <div className="deal-file-actions">
          <input
            ref={fileInput}
            type="file"
            accept=".docx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (
                  !f.name.toLowerCase().endsWith(".docx") ||
                  f.size > 10 * 1024 * 1024
                ) {
                  setError("Use an English, text-based DOCX up to 10 MB.");
                  return;
                }
                setSource(f.name);
                void open(f);
              }
            }}
          />
          <button disabled={!!busy} onClick={() => fileInput.current?.click()}>
            <Upload size={15} /> Open DOCX
          </button>
          <button disabled={!ready || !!busy} onClick={() => void download()}>
            <Download size={15} /> Download Word
          </button>
        </div>
      </section>
      <section className="terms-strip">
        <div className="terms-heading">
          <span className="small-icon">
            <FileText size={17} />
          </span>
          <div>
            <b>Agreed terms</b>
            <small>Fictional commercial instructions</small>
          </div>
        </div>
        <label>
          Customer data
          <select
            aria-label="Training policy"
            value={policy.training}
            disabled={!ready || !!busy}
            onChange={(e) =>
              void changeTerms({
                ...policy,
                training: e.target.value as Policy["training"],
              })
            }
          >
            <option value="consent">Specific written consent to train</option>
            <option value="prohibited">No model training permitted</option>
          </select>
        </label>
        <label>
          Renewal notice
          <select
            aria-label="Renewal notice"
            value={policy.notice}
            disabled={!ready || !!busy}
            onChange={(e) =>
              void changeTerms({
                ...policy,
                notice: Number(e.target.value) as Policy["notice"],
              })
            }
          >
            {[30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
        </label>
        <div className="terms-fixed">
          <ShieldCheck size={17} />
          <span>
            Preserve negotiated payment terms
            <br />
            <b>Escalate telemetry & liability</b>
          </span>
        </div>
      </section>
      <div className="deal-actionbar">
        <div className="data-consent">
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{" "}
            Send extracted clause text to TypeSafe for this review.
          </label>
          <small>
            DOCX stays in your browser. No contract text stored in app logs. 5
            reviews/hour · 25,000 tokens max.
          </small>
        </div>
        <button
          className="primary"
          disabled={!ready || !!busy || !consent}
          onClick={() => void check()}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Play size={15} />
          )}{" "}
          {busy ||
            (review ? "Recheck changed clauses" : "Review the agreement")}
        </button>
      </div>
      {error && (
        <div className="desk-error" role="alert">
          <AlertTriangle size={17} />
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={15} />
          </button>
        </div>
      )}
      <main className="desk-grid">
        <aside className="review-queue">
          <div className="queue-title">
            <span>REVIEW BOARD</span>
            <span>{RULES.length} locations</span>
          </div>
          <div className="queue-summary">
            <strong>{pending.length || eligibleCount}</strong>
            <span>
              {pending.length
                ? "reviewable redlines"
                : eligibleCount
                  ? "ready to propose"
                  : "awaiting review"}
            </span>
            {eligibleCount > 0 && (
              <button
                className="primary compact"
                disabled={!!busy || stale}
                onClick={() => void applyReady()}
              >
                Propose {eligibleCount} <ChevronRight size={14} />
              </button>
            )}
          </div>
          {!!review && approvalRows.length > 0 && (
            <button
              className="review-language"
              onClick={() => setTab("matrix")}
            >
              Review {approvalRows.length} proposed edits{" "}
              <ChevronRight size={13} />
            </button>
          )}
          {[
            "Data use",
            "Renewal",
            "Human decisions",
            "Preserve concessions",
          ].map((group) => (
            <div className="queue-group" key={group}>
              <h2>{group}</h2>
              {RULES.filter((r) => r.group === group).map((r) => {
                const readingRow = reading?.rows.find((x) => x.id === r.id);
                const status = readingRow ? state(readingRow) : "Loading";
                return (
                  <button
                    key={r.id}
                    className={`queue-row ${selected === r.id ? "selected" : ""}`}
                    onClick={() => void navigate(r.id)}
                    disabled={!ready}
                  >
                    <span
                      className={`status-dot ${["Aligned", "Preserve", "Redline ready"].includes(status) ? "green" : ["Human decision", "Approve insertion", "Recheck"].includes(status) ? "amber" : status === "Ready to redline" ? "blue" : ""}`}
                    />
                    <span>
                      <b>{r.label}</b>
                      <small>{r.location}</small>
                      <em>{status}</em>
                    </span>
                    <ChevronRight size={14} />
                  </button>
                );
              })}
            </div>
          ))}
          <button
            className="reset-desk"
            onClick={() => {
              setSource("Meridian’s returned agreement");
              void open();
            }}
            disabled={!!busy}
          >
            <RotateCcw size={14} /> Reset fictional sample
          </button>
          <Link className="advanced-link" href="/playbook">
            General DOCX playbook review <ArrowUpRight size={12} />
          </Link>
        </aside>
        <section className="desk-canvas">
          <div className="canvas-tabs">
            <div>
              <button
                className={tab === "document" ? "active" : ""}
                onClick={() => setTab("document")}
              >
                <FileText size={14} /> Document
              </button>
              <button
                className={tab === "matrix" ? "active" : ""}
                onClick={() => setTab("matrix")}
              >
                <Table2 size={14} /> Review matrix
              </button>
              <button
                className={tab === "developer" ? "active" : ""}
                onClick={() => setTab("developer")}
              >
                <Code2 size={14} /> Execution
              </button>
            </div>
            <span>{reading ? `rev ${reading.revision}` : "Opening…"}</span>
          </div>
          <div className="canvas-status">
            <span>
              <FileText size={13} /> {source}
            </span>
            <span>
              <GitPullRequest size={13} /> {reading?.changes.length ?? "–"}{" "}
              revisions <MessageSquare size={13} /> {reading?.comments ?? "–"}
            </span>
          </div>
          <div
            className={
              tab === "document"
                ? "document-surface"
                : "document-surface hidden"
            }
          >
            <div id="desk-toolbar" />
            <div className="desk-document-scroll">
              <div ref={mount} className="desk-document" />
            </div>
          </div>
          {tab === "matrix" && (
            <div className="matrix-view">
              <div className="view-intro">
                <span className="eyebrow">
                  SEMANTIC REVIEW → DOCUMENT ACTION
                </span>
                <h2>Every decision has a location.</h2>
                <p>
                  Live Jev results, with application-enforced routing. Click a
                  row to inspect its actual Word clause.
                </p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Contract location</th>
                    <th>Jev decision</th>
                    <th>Confidence</th>
                    <th>Execution</th>
                  </tr>
                </thead>
                <tbody>
                  {RULES.map((r) => {
                    const x = reading?.rows.find((y) => y.id === r.id),
                      d = x ? currentDecision(x) : undefined;
                    return (
                      <tr key={r.id} onClick={() => void navigate(r.id)}>
                        <td>
                          <b>{r.label}</b>
                          <small>{r.location}</small>
                        </td>
                        <td>
                          {d?.verdict.replaceAll("_", " ").toLowerCase() ??
                            (cache[r.id] ? "stale" : "not checked")}
                        </td>
                        <td>{d ? percent(d.confidence) : "—"}</td>
                        <td>
                          <span className="matrix-state">
                            {x ? state(x) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!!review && approvalRows.length > 0 && (
                <section className="approval-sheet">
                  <h3>Review the proposed language</h3>
                  <p>
                    These bounded edits implement the supplied terms. Approving
                    here authorizes the displayed replacements; every result
                    remains a tracked suggestion.
                  </p>
                  {approvalRows.map((r) => (
                    <div key={r.id}>
                      <b>{RULES.find((x) => x.id === r.id)!.location}</b>
                      <del>{r.clause!.text}</del>
                      <ins>{r.replacement}</ins>
                    </div>
                  ))}
                  <button
                    className="primary"
                    disabled={!!busy}
                    onClick={() => void applyReady(true)}
                  >
                    Approve language & propose {approvalRows.length} redlines
                  </button>
                </section>
              )}
              <div className="matrix-note">
                <ShieldCheck size={17} />
                <p>
                  <b>A confident decision is not permission to edit.</b>{" "}
                  Existing revisions, missing terms and unsettled positions
                  remain gated. Only supported replacements at ≥95% confidence
                  can be proposed automatically.
                </p>
              </div>
            </div>
          )}
          {tab === "developer" && (
            <div className="execution-view">
              <div className="view-intro">
                <span className="eyebrow">INSPECT THE BOUNDARY</span>
                <h2>Models decide. Code operates the document.</h2>
                <p>
                  Jev returns typed judgments. SuperDoc resolves document
                  targets, creates reviewable changes, and returns receipts. The
                  application checks the result.
                </p>
              </div>
              <div className="execution-flow">
                <div>
                  <b>01 · Jev</b>
                  <small>Decision + full distribution</small>
                </div>
                <ChevronRight />
                <div>
                  <b>02 · Application</b>
                  <small>Fresh revision + policy guards</small>
                </div>
                <ChevronRight />
                <div>
                  <b>03 · SuperDoc</b>
                  <small>Tracked change + readback</small>
                </div>
              </div>
              <h3>Selected operation · {rule.label}</h3>
              <pre>
                {JSON.stringify(
                  op
                    ? {
                        operation:
                          op.kind === "insert" ? "lists.insert" : "replace",
                        mode: "tracked",
                        target: op.blockId,
                        expectedRevision: op.beforeRevision,
                        resultingRevision: op.afterRevision,
                        verified: op.verified,
                        existingRevisionsPreserved: op.preserved,
                        trackedChangeIds: op.changeIds,
                        commentId: op.commentId,
                        receipt: op.receipt,
                      }
                    : {
                        status: "No operation executed",
                        target: row?.clause?.id,
                        revision: reading?.revision,
                        plannedOperation:
                          rule.kind === "insert"
                            ? "lists.insert"
                            : rule.kind === "replace"
                              ? "replace"
                              : "human review",
                        modelResponse: previous,
                      },
                  null,
                  2,
                )}
              </pre>
              <div className="headless-card">
                <Code2 size={22} />
                <div>
                  <b>The same operations without a browser</b>
                  <p>
                    The repository includes a Node.js runner using
                    @superdoc/sdk. Run live decisions locally, save a tracked
                    DOCX, then open it here for human review.
                  </p>
                  <code>npm run demo:headless -- ./public/deal-desk.docx</code>
                  <a
                    href="https://github.com/jelkes1/superdoc-jev-demo/blob/main/examples/headless.ts"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the runnable example <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
              <p className="muted">
                The hosted demo executes DOCX operations in your browser. The
                Node example runs on your own machine.
              </p>
            </div>
          )}
        </section>
        <aside className="finding-inspector">
          <div className="inspector-top">
            <span>SELECTED FINDING</span>
            <span>
              {RULES.findIndex((r) => r.id === selected) + 1} / {RULES.length}
            </span>
          </div>
          <span className="eyebrow">{rule.location}</span>
          <h2>{rule.label}</h2>
          <div className="finding-rule">
            <b>Instruction</b>
            <p>{requirement(rule, policy)}</p>
          </div>
          {(decision || previous) && (
            <section className={`decision-card ${!decision ? "stale" : ""}`}>
              <div>
                <span>
                  {decision ? "JEV DECISION" : "PREVIOUS DECISION · STALE"}
                </span>
                <b>
                  {(decision ?? previous)!.verdict
                    .replaceAll("_", " ")
                    .toLowerCase()}
                </b>
              </div>
              <strong>
                {percent((decision ?? previous)!.confidence)}
                <small>confidence</small>
              </strong>
              <details>
                <summary>Inspect probability distribution</summary>
                {Object.entries((decision ?? previous)!.probabilities).map(
                  ([k, v]) => (
                    <div className="probability" key={k}>
                      <span>{k.toLowerCase().replaceAll("_", " ")}</span>
                      <b>{percent(v)}</b>
                      <progress value={v} max={1} />
                    </div>
                  ),
                )}
              </details>
            </section>
          )}
          {!review && (
            <div className="empty-decision">
              <span className="small-icon">
                <Play size={17} />
              </span>
              <p>Run the review to get a real Jev decision for this clause.</p>
            </div>
          )}
          {row?.problem && <p className="warning-text">{row.problem}</p>}
          <div className="inspector-text">
            <b>
              {rule.kind === "insert" && !row?.present
                ? "Insert after this numbered item"
                : "Current document text"}
            </b>
            <p>{row?.clause?.text ?? "Locating the clause…"}</p>
          </div>
          {row?.replacement &&
            row.clause?.text !== row.replacement &&
            !pending.some((o) => o.id === selected) && (
              <div className="proposed-text">
                <b>
                  {rule.kind === "insert"
                    ? "Proposed numbered safeguard"
                    : "Proposed language"}
                </b>
                <p>{row.replacement}</p>
                <small>Predefined language for this guided scenario</small>
              </div>
            )}
          {op?.status === "pending" ? (
            <div className="review-controls">
              <div className="verification">
                <ShieldCheck size={17} />
                <b>
                  {op.verified
                    ? "Tracked edit verified"
                    : "Inspect verification"}
                </b>
              </div>
              <p>
                Text read back · Revision created · Counsel’s existing changes
                preserved
              </p>
              <div>
                <button
                  className="primary"
                  disabled={!!busy}
                  onClick={() => void decide(op, "accept")}
                >
                  <Check size={15} /> Accept
                </button>
                <button
                  disabled={!!busy}
                  onClick={() => void decide(op, "reject")}
                >
                  <X size={15} /> Reject
                </button>
              </div>
            </div>
          ) : (
            op && (
              <p className="reviewed-label">
                <Check size={15} /> You {op.status} this proposal.
              </p>
            )
          )}
          {row &&
            eligible(row, decision) &&
            !pending.some((o) => o.id === selected) && (
              <button
                className="primary inspector-primary"
                disabled={!!busy || stale}
                onClick={() => void apply(selected)}
              >
                <GitPullRequest size={16} /> Propose tracked replacement
              </button>
            )}
          {row &&
            rule.kind === "replace" &&
            decision &&
            decision.verdict !== "ACCEPTABLE" &&
            !eligible(row, decision) &&
            !row.existing.length &&
            row.replacement &&
            row.replacement !== row.clause?.text &&
            !row.problem && (
              <div className="human-gate">
                <b>Approval required</b>
                <p>
                  This decision does not qualify for the 95% automatic-proposal
                  threshold. Review the proposed language first.
                </p>
                <button
                  disabled={!!busy}
                  onClick={() => void apply(selected, true)}
                >
                  Approve this replacement
                </button>
              </div>
            )}
          {rule.kind === "insert" &&
            review &&
            !row?.present &&
            !row?.problem && (
              <div className="human-gate">
                <AlertTriangle size={17} />
                <p>
                  A missing clause changes the scope of the agreement. Approve
                  this language and insertion point before it becomes a tracked
                  list item.
                </p>
                <button
                  disabled={!!busy}
                  onClick={() => void apply(selected, true)}
                >
                  Approve numbered insertion
                </button>
              </div>
            )}
          {rule.kind === "review" && (
            <div className="human-gate">
              <MessageSquare size={17} />
              <b>Human decision required</b>
              <p>
                {selected === "liability"
                  ? "Counsel proposed a 36-month cap; authority is 24 months. This is not settled. Their redline remains untouched."
                  : "The commercial instructions do not settle de-identified excerpts and Operational Signals. A high model score cannot authorize this exception."}
              </p>
              {selected === "signals" &&
                reasoning &&
                policy.training === "consent" && (
                  <>
                    <p>
                      Requesting a draft sends this clause to OpenAI. Two drafts
                      per review; proposed text still needs your approval.
                    </p>
                    <button
                      disabled={!!busy}
                      onClick={() => void requestDraft()}
                    >
                      Ask reasoning model for a draft
                    </button>
                  </>
                )}
              {selected === "signals" && reasoned && (
                <div className="reasoned-draft">
                  <b>{reasoned.model} · Draft for review</b>
                  <p>{reasoned.explanation}</p>
                  {reasoned.proposal && (
                    <>
                      <p>{reasoned.proposal.replacement}</p>
                      <button
                        disabled={
                          !!busy || pending.some((o) => o.id === "signals")
                        }
                        onClick={() => void proposeDraft()}
                      >
                        Approve draft as a tracked change
                      </button>
                    </>
                  )}
                  <small>
                    {Math.round(reasoned.usage.latencyMs)} ms ·{" "}
                    {reasoned.usage.inputTokens} input /{" "}
                    {reasoned.usage.outputTokens} output tokens
                  </small>
                </div>
              )}
            </div>
          )}
          {rule.kind === "preserve" && (
            <div className="preserved-card">
              <ShieldCheck size={18} />
              <p>
                <b>A concession worth keeping.</b> Counsel’s 45 → 30 day payment
                revision and its comment stay in the document.
              </p>
            </div>
          )}
          {row?.clause && rule.kind === "replace" && !row.existing.length && (
            <details className="try-edit">
              <summary>Try a counter-edit</summary>
              <p>
                Change the actual clause, then recheck. Only affected locations
                are sent to Jev again.
              </p>
              {editing ? (
                <>
                  <textarea
                    aria-label="Counter-edit text"
                    value={humanText}
                    onChange={(e) => setHumanText(e.target.value)}
                  />
                  <button
                    disabled={!!busy || !humanText.trim()}
                    onClick={() => void editClause()}
                  >
                    Save into DOCX
                  </button>
                </>
              ) : (
                <button
                  disabled={!!busy}
                  onClick={() => {
                    setHumanText(row.clause!.text);
                    setEditing(true);
                  }}
                >
                  Edit this clause
                </button>
              )}
            </details>
          )}
          <button className="inspect-link" onClick={() => setTab("developer")}>
            <Code2 size={14} /> Inspect target & receipt{" "}
            <ArrowUpRight size={13} />
          </button>
        </aside>
      </main>
      <footer className="desk-footer">
        <span className={stale ? "footer-stale" : ""}>
          {stale ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}{" "}
          {stale
            ? `${changed.length || "Some"} locations need rechecking`
            : lastCheck || "Fictional agreement · Original revisions included"}
        </span>
        <span>
          {review
            ? `${review.usage.decisions} decisions · ${Math.round(review.usage.latencyMs)} ms provider call · ${review.usage.inputTokens.toLocaleString()} input / ${review.usage.outputTokens} output tokens${reused ? ` · ${reused} reused` : ""}`
            : "Jev evaluates · SuperDoc executes · A human reviews"}
        </span>
      </footer>
    </div>
  );
}
