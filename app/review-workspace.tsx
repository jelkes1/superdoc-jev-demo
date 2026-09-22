"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SuperDoc as SuperDocInstance } from "superdoc";
import {
  FileText,
  ArrowUpRight,
  Upload,
  Download,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Code2,
  Check,
  X,
  RotateCcw,
  LoaderCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  extractClauses,
  applyTrackedReplacement,
  clearPending,
  validatePending,
  listChanges,
} from "@/lib/review/document";
import {
  playbook,
  deterministicProposal,
  RULE_LABELS,
  rules,
} from "@/lib/review/playbook";
import { routeDecision } from "@/lib/review/routing";
import { readReview } from "@/lib/review/stream";
import {
  VERDICTS,
  type Clause,
  type Decision,
  type Playbook,
  type Proposal,
  type Suggestion,
  type Usage,
  type RuleId,
} from "@/lib/review/types";
interface Draft {
  proposal: Proposal | null;
  explanation: string;
  revision: string;
}
interface Service {
  jev: boolean;
  reasoning: boolean;
  jevModel: string;
  reasoningModel: string;
}
const message = (e: unknown) =>
  e instanceof Error ? e.message : "This operation could not be completed.";
// Browser integration tests access the real editor only in Vite development builds.
declare global {
  interface Window {
    __demo?: {
      instance: SuperDocInstance;
      extract: typeof extractClauses;
      apply: typeof applyTrackedReplacement;
      clear: typeof clearPending;
      validate: typeof validatePending;
      changes: typeof listChanges;
    };
  }
}
export default function ReviewWorkspace() {
  const mount = useRef<HTMLDivElement>(null),
    instance = useRef<SuperDocInstance | null>(null),
    input = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    run = useRef(0);
  const [ready, setReady] = useState(false),
    [name, setName] = useState("Northstar × Meridian"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState("");
  const [months, setMonths] = useState<12 | 24>(12),
    [threshold, setThreshold] = useState(95),
    [service, setService] = useState<Service | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]),
    [clauses, setClauses] = useState<Clause[]>([]),
    [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [drafts, setDrafts] = useState<Record<string, Draft>>({}),
    [issues, setIssues] = useState<Record<string, string>>({});
  const [usage, setUsage] = useState<Usage | null>(null),
    [reasonUsage, setReasonUsage] = useState<Usage | null>(null),
    [total, setTotal] = useState(0),
    [missing, setMissing] = useState<RuleId[]>([]),
    [filter, setFilter] = useState("findings"),
    [active, setActive] = useState(""),
    [runPolicy, setRunPolicy] = useState<Playbook>(playbook());
  const doc = () => {
    const d = instance.current?.activeEditor?.doc;
    if (!d) throw new Error("The document is still loading.");
    return d;
  };
  function reset() {
    setDecisions([]);
    setClauses([]);
    setSuggestions([]);
    setDrafts({});
    setIssues({});
    setUsage(null);
    setReasonUsage(null);
    setTotal(0);
    setMissing([]);
    setActive("");
  }
  async function open(file?: File) {
    const ticket = ++generation.current;
    run.current++;
    setReady(false);
    setNotice("");
    try {
      if (file) {
        if (!file.name.toLowerCase().endsWith(".docx"))
          throw new Error(
            "Choose a text-based .docx file. PDF, .doc and .docm are not supported.",
          );
        if (file.size > 10 * 1024 * 1024)
          throw new Error("This file exceeds the 10 MB limit.");
        const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        if (bytes[0] !== 80 || bytes[1] !== 75)
          throw new Error("This is not an unencrypted DOCX file.");
      }
      const { SuperDoc } = await import("superdoc");
      if (ticket !== generation.current) return;
      instance.current?.destroy();
      mount.current!.replaceChildren();
      document.getElementById("editor-toolbar")?.replaceChildren();
      reset();
      const sd = new SuperDoc({
        selector: mount.current!,
        document: file ?? "/northstar-meridian.docx",
        documentMode: "suggesting",
        role: "editor",
        user: { name: "SuperDoc × Jev", email: "demo@example.invalid" },
        ui: {
          toolbar: {
            container: "#editor-toolbar",
            responsiveToContainer: true,
          },
          comments: true,
          search: true,
          ruler: false,
        },
        zoom: {
          mode: "fit-width",
          fitWidth: { min: 45, max: 100, padding: 44 },
        },
        onReady: () => {
          if (ticket === generation.current) setReady(true);
        },
        onException: () => {
          if (ticket === generation.current)
            setNotice(
              "SuperDoc encountered a document issue. If it cannot open, use an unencrypted, text-based English DOCX.",
            );
        },
      });
      instance.current = sd;
      if (import.meta.env.DEV)
        window.__demo = {
          instance: sd,
          extract: extractClauses,
          apply: applyTrackedReplacement,
          clear: clearPending,
          validate: validatePending,
          changes: listChanges,
        };
      setName(file?.name ?? "Northstar × Meridian");
    } catch (e) {
      setNotice(message(e));
      if (instance.current?.activeEditor) setReady(true);
    }
  }
  // This effect owns one editor lifecycle; the counters intentionally invalidate pending work at cleanup.
  /* eslint-disable react-hooks/exhaustive-deps -- The mount effect owns the editor; generation counters cancel unfinished loads. */
  useEffect(() => {
    void open();
    void fetch("/api/status")
      .then((r) => r.json() as Promise<Service>)
      .then(setService)
      .catch(() =>
        setNotice(
          "Service status is unavailable. Document editing and export still work.",
        ),
      );
    return () => {
      generation.current++;
      run.current++;
      instance.current?.destroy();
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */
  async function navigate(c: Clause, s?: Suggestion) {
    try {
      setActive(s?.decisionId ?? c.id);
      const target = s?.verification.changeIds[0]
        ? {
            kind: "entity" as const,
            entityType: "trackedChange" as const,
            entityId: s.verification.changeIds[0],
          }
        : {
            kind: "text" as const,
            blockId: c.nodeId,
            range: { start: 0, end: Math.min(c.text.length, 80) },
          };
      const result = await instance.current!.ui.viewport.scrollIntoView({
        target,
        block: "center",
        behavior: "instant",
      });
      if (!result.success)
        throw new Error(
          "This location changed. Rerun review to refresh its target.",
        );
    } catch (e) {
      setNotice(message(e));
    }
  }
  async function review() {
    if (busy) return;
    if (!service?.jev) {
      setNotice(
        "Live Jev review is not connected yet. No model results have been generated. You can edit and download the document.",
      );
      return;
    }
    setBusy(true);
    setNotice("");
    setPhase("Reading document…");
    const ticket = ++run.current;
    let reviewId = "";
    const results: Decision[] = [];
    const created: Suggestion[] = [];
    try {
      const api = doc();
      await clearPending(api, suggestions);
      const extracted = await extractClauses(api);
      const p = playbook(months, threshold / 100);
      setRunPolicy(p);
      setClauses(extracted.clauses);
      setSuggestions(
        suggestions.filter(
          (s) => s.status === "accepted" || s.status === "rejected",
        ),
      );
      setDrafts({});
      setIssues({});
      setDecisions([]);
      setMissing([]);
      setUsage(null);
      setReasonUsage(null);
      setNotice(extracted.warnings.join(" "));
      setPhase("Jev is evaluating clauses…");
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clauses: extracted.clauses,
          revision: extracted.revision,
          playbook: p,
        }),
      });
      await readReview(response, (e) => {
        if (ticket !== run.current) return;
        if (e.type === "start") {
          reviewId = e.reviewId;
          setTotal(e.total);
        }
        if (e.type === "batch") {
          results.push(...e.decisions);
          setDecisions([...results]);
          setPhase(`Jev returned ${results.length} decisions…`);
        }
        if (e.type === "complete") {
          setUsage(e.usage);
          setMissing(e.missingRules);
        }
      });
      if (ticket !== run.current) return;
      let expected = extracted.revision;
      setPhase("Verifying tracked proposals…");
      for (const d of results) {
        const c = extracted.clauses.find((c) => c.id === d.clauseId)!;
        if (routeDecision(d, c, p) !== "propose") continue;
        try {
          const suggestion = await applyTrackedReplacement(
            api,
            c,
            deterministicProposal(c, d.ruleId, p)!,
            d.id,
            expected,
          );
          expected = suggestion.verification.afterRevision;
          created.push(suggestion);
          setSuggestions((prev) => [...prev, suggestion]);
          if (created.length === 1) void navigate(c, suggestion);
        } catch (e) {
          setIssues((prev) => ({ ...prev, [d.id]: message(e) }));
        }
      }
      const unresolved = results
        .filter(
          (d) =>
            d.reasonToken &&
            routeDecision(
              d,
              extracted.clauses.find((c) => c.id === d.clauseId)!,
              p,
            ) === "reason",
        )
        .sort(
          (a, b) =>
            Number(b.verdict === "NEEDS_REVIEW") -
            Number(a.verdict === "NEEDS_REVIEW"),
        )
        .slice(0, 2);
      const reasoningTotals: Usage = {
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        latencyMs: 0,
        decisions: 0,
      };
      for (const d of unresolved) {
        setPhase("Drafting an unresolved finding…");
        const c = extracted.clauses.find((c) => c.id === d.clauseId)!;
        try {
          const response = await fetch("/api/reason", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewId,
              reasonToken: d.reasonToken,
              clause: c,
              ruleId: d.ruleId,
              playbook: p,
            }),
          });
          const data = (await response.json()) as {
            error?: string;
            proposal: Proposal | null;
            explanation: string;
            usage: Usage;
          };
          if (!response.ok)
            throw new Error(data.error ?? "Reasoning is unavailable.");
          setDrafts((prev) => ({
            ...prev,
            [d.id]: {
              proposal: data.proposal,
              explanation: data.explanation,
              revision: expected,
            },
          }));
          for (const key of [
            "inputTokens",
            "outputTokens",
            "costUsd",
            "latencyMs",
          ] as const)
            reasoningTotals[key] += data.usage[key];
          setReasonUsage({ ...reasoningTotals });
        } catch (e) {
          setIssues((prev) => ({ ...prev, [d.id]: message(e) }));
        }
      }
      setPhase("Review complete");
    } catch (e) {
      setNotice(message(e));
      setPhase("Review stopped");
    } finally {
      setBusy(false);
    }
  }
  async function decide(s: Suggestion, decision: "accept" | "reject") {
    try {
      await validatePending(doc(), [s]);
      const current = await doc().info({});
      const result = await doc().trackChanges.decide(
        { decision, target: { kind: "ids", ids: s.verification.changeIds } },
        { expectedRevision: current.revision },
      );
      if (!result.success)
        throw new Error(
          "The suggestion changed. Review its remaining revisions in the document.",
        );
      const remaining = await listChanges(doc());
      if (remaining.some((c) => s.verification.changeIds.includes(c.id)))
        throw new Error("Some revisions remain unresolved.");
      setSuggestions((prev) =>
        prev.map((x) =>
          x === s
            ? { ...x, status: decision === "accept" ? "accepted" : "rejected" }
            : x,
        ),
      );
    } catch (e) {
      setNotice(message(e));
    }
  }
  async function applyDraft(d: Decision, c: Clause) {
    try {
      const draft = drafts[d.id];
      if (!draft?.proposal) return;
      const s = await applyTrackedReplacement(
        doc(),
        c,
        draft.proposal,
        d.id,
        draft.revision,
      );
      setSuggestions((prev) => [...prev, s]);
      void navigate(c, s);
    } catch (e) {
      setIssues((prev) => ({ ...prev, [d.id]: message(e) }));
    }
  }
  async function download() {
    try {
      await instance.current?.export({
        isFinalDoc: false,
        exportedName: "reviewed-agreement",
      });
    } catch (e) {
      setNotice(message(e));
    }
  }
  const visible = decisions
    .filter(
      (d) =>
        filter === "all" ||
        d.verdict !== "NOT_APPLICABLE" ||
        d.confidence < runPolicy.threshold,
    )
    .sort(
      (a, b) =>
        Number(b.verdict === "UNACCEPTABLE") -
          Number(a.verdict === "UNACCEPTABLE") ||
        Number(b.verdict === "NEEDS_REVIEW") -
          Number(a.verdict === "NEEDS_REVIEW"),
    );
  const pending = suggestions.filter((s) => s.status === "pending").length;
  return (
    <main className="workspace">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brandmark">
            <FileText size={21} />
          </span>
          superdoc <span className="times">×</span>
          <span className="jev-word">jev</span>
        </Link>
        <span className="edition">THE DOCUMENT DECISION LAB</span>
        <a
          className="source-link"
          href="https://github.com/jelkes1/superdoc-jev-demo"
          target="_blank"
          rel="noreferrer"
        >
          View source <ArrowUpRight size={15} />
        </a>
      </header>
      <section className="titlebar">
        <div>
          <div className="eyebrow">FROM DECISION TO DOCUMENT</div>
          <h1>Decide. Redline. Review.</h1>
          <p>
            Jev evaluates the contract. SuperDoc proposes tracked edits. You
            review.
          </p>
        </div>
        <div className="file-actions">
          <input
            ref={input}
            type="file"
            accept=".docx"
            hidden
            onChange={(e) => {
              if (e.target.files?.[0]) void open(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Upload size={15} />
            Open your DOCX
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy}
            onClick={() => void download()}
          >
            <Download size={15} />
            Download
          </Button>
        </div>
      </section>
      <div className="workbench">
        <section className="document-pane">
          <div className="document-tab">
            <FileText size={16} />
            <strong>{name}</strong>
            <span className="filetag">.DOCX</span>
            <span className="local-tag">DOCX stays in your browser</span>
            <button
              className="sample-button"
              disabled={busy}
              title="Reopen the sample (discards current edits)"
              onClick={() => void open()}
            >
              <RotateCcw size={14} />
              Sample
            </button>
          </div>
          <div id="editor-toolbar" />
          <div className="document-scroll">
            <div ref={mount} id="superdoc-editor" />
          </div>
        </section>
        <aside className="review-pane">
          <div className="panel-intro">
            <div className="panel-kicker">
              <span className="mini-mark">∴</span> PLAYBOOK REVIEW
            </div>
            <h2>
              Your policy.
              <br />
              In the document.
            </h2>
            <p>
              Five checks. Real Word redlines.
              <br />
              You decide what stays.
            </p>
          </div>
          <div className="playbook-box">
            <div className="box-title">
              <SlidersHorizontal size={16} />
              <strong>Software vendor playbook</strong>
            </div>
            <label>
              Liability cap{" "}
              <select
                aria-label="Liability cap"
                disabled={busy}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) as 12 | 24)}
              >
                <option value="12">12 months of fees</option>
                <option value="24">24 months of fees</option>
              </select>
            </label>
            <label htmlFor="confidence">
              Auto-proposal confidence <strong>{threshold}%</strong>
            </label>
            <input
              id="confidence"
              disabled={busy}
              aria-label="Auto-proposal confidence"
              type="range"
              min="70"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <details>
              <summary>See all five rules</summary>
              <ul>
                {Object.entries(rules(playbook(months, threshold / 100))).map(
                  ([key, text]) => (
                    <li key={key}>{text}</li>
                  ),
                )}
              </ul>
            </details>
          </div>
          <Button
            className="review-button"
            disabled={!ready || busy}
            onClick={() => void review()}
          >
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Play size={15} fill="currentColor" />
            )}
            {busy
              ? "Reviewing…"
              : decisions.length
                ? "Rerun against playbook"
                : "Review against playbook"}
          </Button>
          <p className="data-note">
            Review sends extracted text to Jev and, for up to two unresolved
            findings, OpenAI. This app does not retain contract contents.
            Providers process text under their own terms.
          </p>
          <p className="limits-note">
            English DOCX · 10 MB · 25,000 tokens · 5 reviews/hour
          </p>
          {service && !service.jev && (
            <div className="connection-note">
              Live review awaits a Jev API key. Editing and export are ready.
            </div>
          )}
          {notice && (
            <div className="notice" role="alert">
              {notice}
            </div>
          )}
          {phase && (
            <div className="phase" role="status">
              {phase}
            </div>
          )}
          {usage && (
            <div className="metrics">
              <strong>
                {usage.decisions} decisions ·{" "}
                {(usage.latencyMs / 1000).toFixed(1)}s
              </strong>
              <span>
                {usage.inputTokens.toLocaleString()} input /{" "}
                {usage.outputTokens.toLocaleString()} output tokens · $
                {usage.costUsd.toFixed(5)}
              </span>
              <span>{pending} verified proposals awaiting review</span>
              {reasonUsage && (
                <span>
                  Reasoning:{" "}
                  {reasonUsage.inputTokens + reasonUsage.outputTokens} tokens ·{" "}
                  {(reasonUsage.latencyMs / 1000).toFixed(1)}s · $
                  {reasonUsage.costUsd.toFixed(4)}
                </span>
              )}
              <span>Measured provider usage · {service?.jevModel}</span>
            </div>
          )}
          {decisions.length > 0 && (
            <div className="finding-controls">
              <strong>
                {decisions.length}
                {total ? ` / ${total}` : ""} decisions
              </strong>
              <select
                aria-label="Findings filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="findings">Relevant / uncertain</option>
                <option value="all">All responses</option>
              </select>
            </div>
          )}
          {missing.map((r) => (
            <div className="finding" key={`missing-${r}`}>
              <b>{RULE_LABELS[r]}</b>
              <p>
                No relevant clause identified. Missing clauses remain
                unresolved; no text was inserted.
              </p>
            </div>
          ))}
          {clauses
            .filter((c) => c.incomplete)
            .map((c) => (
              <div className="finding" key={c.id}>
                <button onClick={() => void navigate(c)}>
                  {c.title}
                  <ChevronRight size={14} />
                </button>
                <p>Incomplete context. Human review required.</p>
              </div>
            ))}
          <div className="findings">
            {visible.map((d) => {
              const c = clauses.find((c) => c.id === d.clauseId);
              if (!c) return null;
              const s = [...suggestions]
                .reverse()
                .find((s) => s.decisionId === d.id);
              const draft = drafts[d.id];
              const route = routeDecision(d, c, runPolicy);
              return (
                <article
                  className={`finding ${active === d.id || active === c.id ? "active" : ""}`}
                  key={d.id}
                  data-verdict={d.verdict}
                  data-rule={d.ruleId}
                >
                  <button
                    className="finding-location"
                    onClick={() => void navigate(c, s)}
                  >
                    <strong>{RULE_LABELS[d.ruleId]}</strong>
                    <ChevronRight size={15} />
                  </button>
                  <div className="finding-meta">
                    <span className={`verdict ${d.verdict.toLowerCase()}`}>
                      {d.verdict.replaceAll("_", " ")}
                    </span>
                    <b>{(d.confidence * 100).toFixed(1)}%</b>
                  </div>
                  <small>{c.title}</small>
                  <blockquote>{c.text}</blockquote>
                  <p className="action-label">
                    {s
                      ? s.status === "pending"
                        ? "Verified tracked replacement"
                        : s.status === "changed"
                          ? "Verification incomplete — inspect redlines"
                          : `Suggestion ${s.status}`
                      : route === "unchanged"
                        ? "Acceptable — no edit"
                        : route === "irrelevant"
                          ? "Not relevant to this rule"
                          : route === "reason"
                            ? "Escalated — human review required"
                            : "Human review required"}
                  </p>
                  {s && (
                    <div className="verification">
                      {s.verification.textVerified &&
                      s.verification.trackedVerified ? (
                        <Check size={14} />
                      ) : (
                        <X size={14} />
                      )}{" "}
                      Text + tracked changes{" "}
                      {s.verification.textVerified &&
                      s.verification.trackedVerified
                        ? "verified"
                        : "not verified"}
                    </div>
                  )}
                  {issues[d.id] && (
                    <p className="finding-error">{issues[d.id]}</p>
                  )}
                  {draft && !s && (
                    <div className="draft">
                      <strong>
                        Reasoning draft · {service?.reasoningModel}
                      </strong>
                      <p>{draft.explanation}</p>
                      {draft.proposal && (
                        <>
                          <blockquote>{draft.proposal.replacement}</blockquote>
                          <Button
                            disabled={busy}
                            onClick={() => void applyDraft(d, c)}
                          >
                            Propose as tracked change
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  {s?.status === "pending" && (
                    <div className="decision-actions">
                      <Button
                        disabled={busy}
                        onClick={() => void decide(s, "accept")}
                      >
                        <Check size={14} />
                        Accept
                      </Button>
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => void decide(s, "reject")}
                      >
                        <X size={14} />
                        Reject
                      </Button>
                    </div>
                  )}
                  <details>
                    <summary>Decision details</summary>
                    <p>
                      Confidence is Jev’s reported value; it is separate from
                      its probability distribution.
                    </p>
                    {VERDICTS.map((v) => (
                      <div className="probability" key={v}>
                        <span>{v.replaceAll("_", " ")}</span>
                        <b>{(d.probabilities[v] * 100).toFixed(2)}%</b>
                      </div>
                    ))}
                    <p>{rules(runPolicy)[d.ruleId]}</p>
                    <code>
                      {d.playbookVersion}
                      <br />
                      {d.model}
                      <br />
                      revision {d.revision}
                    </code>
                    {s && <pre>{JSON.stringify(s.verification, null, 2)}</pre>}
                  </details>
                </article>
              );
            })}
          </div>
          {!decisions.length && !busy && (
            <div className="ready-state">
              <ShieldCheck size={26} />
              <h3>Every change is yours to review.</h3>
              <p>
                Click a finding to locate its clause. Safe replacements become
                tracked edits; ambiguous cases remain open for human review.
              </p>
            </div>
          )}
          <a
            className="developer-note"
            href="/walkthrough"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 size={16} />
            How the integration works
            <ArrowUpRight size={14} />
          </a>
        </aside>
      </div>
      <footer>
        BUILT WITH SUPERDOC{" "}
        <span>A real DOCX. Typed decisions. Reviewable changes.</span>
        <span>Fictional sample · Developer demonstration</span>
      </footer>
    </main>
  );
}
