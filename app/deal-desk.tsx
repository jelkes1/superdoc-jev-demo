"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RunProof from "./run-proof";
import { RunMeasurements, type Phase } from "@/lib/deal-desk/measurements";
import type { CompareInput } from "@/lib/compare/input";
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
    fileInput = useRef<HTMLInputElement>(null),
    inspector = useRef<HTMLElement>(null);
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
  const [navigating, setNavigating] = useState(false);
  const [guided, setGuided] = useState(true),
    [step, setStep] = useState(1);
  const [selectedProposals, setSelectedProposals] = useState<RuleId[]>([
    "training",
    "training-order",
    "renewal",
    "renewal-order",
  ]);
  const [deferred, setDeferred] = useState<RuleId[]>([]);
  const meter = useRef(new RunMeasurements());
  const [measurements, setMeasurements] = useState(() =>
    new RunMeasurements().snapshot(),
  );
  function begin(phase: Phase) {
    meter.current.begin(
      phase,
      reading?.revision ?? "opening",
      `${VERSION}:${JSON.stringify(policy)}`,
    );
  }
  function finish() {
    meter.current.end();
    setMeasurements(meter.current.snapshot());
  }
  async function measuredApply(...args: Parameters<typeof applyOperation>) {
    meter.current.attempt();
    let result: Operation;
    try {
      result = await applyOperation(...args);
    } catch (e) {
      meter.current.operation();
      throw e;
    }
    meter.current.operation(result);
    return result;
  }
  async function comparisonSnapshot(): Promise<CompareInput> {
    const fresh = await readDocument(doc(), policy);
    return {
      revision: fresh.revision,
      version: VERSION,
      policy,
      rows: fresh.rows
        .filter((r) => r.clause && !r.problem)
        .map((r) => ({ id: r.id, text: r.clause!.text, context: r.context })),
    };
  }
  const doc = () => {
    const d = instance.current?.activeEditor?.doc;
    if (!d) throw new Error("The document is loading.");
    return d;
  };
  async function open(file?: File | string) {
    const ticket = ++generation.current;
    setReady(false);
    setStep(1);
    setSelected("training");
    setTab("document");
    setDeferred([]);
    setSelectedProposals([
      "training",
      "training-order",
      "renewal",
      "renewal-order",
    ]);
    meter.current = new RunMeasurements(undefined, crypto.randomUUID());
    setMeasurements(meter.current.snapshot());
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
    setReasoning(undefined);
    setReasoned(undefined);
    try {
      const { SuperDoc } = await import("superdoc");
      if (ticket !== generation.current) return;
      instance.current?.destroy();
      mount.current!.replaceChildren();
      document.getElementById("desk-toolbar")?.replaceChildren();
      let fitFrame = 0;
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
        // Apply viewport fitting on the next animation frame, outside ResizeObserver delivery.
        zoom: { mode: "manual", initial: 85 },
        onViewportChange: ({ fitZoom }) => {
          cancelAnimationFrame(fitFrame);
          fitFrame = requestAnimationFrame(() => {
            if (ticket === generation.current)
              sd.ui.zoom.set(Math.max(25, Math.min(110, fitZoom - 3)));
          });
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
          setStale(dirty.length > 0);
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
    setNavigating(true);
    setError("");
    try {
      setSelected(id);
      setTab("document");
      setEditing(false);
      inspector.current?.scrollTo({ top: 0, behavior: "instant" });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const fresh = await readDocument(doc(), policy);
      const row = fresh.rows.find((x) => x.id === id);
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
        if (!r.success) {
          // Virtual page mounting can trail a sidebar/zoom layout change by one frame.
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          const retried = await instance.current!.ui.viewport.scrollIntoView({
            target: {
              kind: "text",
              blockId: row.clause.nodeId,
              range: { start: 0, end: 0 },
            },
            block: "center",
            behavior: "instant",
          });
          if (!retried.success)
            setError(
              "This location could not be scrolled into view. Its finding remains available; recheck if you edited it.",
            );
        }
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setNavigating(false);
    }
  }
  async function check() {
    if (busy) return;
    begin("review");
    setBusy("Reading current document targets…");
    setError("");
    let requested = false,
      reported = false;
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
        if (!review) setStep(2);
        return;
      }
      setBusy(`Jev is checking ${pending.length} changed locations…`);
      requested = true;
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
      if (result.usage) {
        meter.current.usage(
          "jev-1.13.0",
          result.usage,
          fresh.revision,
          `${VERSION}:${JSON.stringify(policy)}`,
        );
        reported = true;
      }
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
      setStep(2);
      setTab("document");
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
      if (requested && !reported) meter.current.unknown();
      finish();
      setBusy("");
    }
  }
  async function apply(id: RuleId, human = false) {
    if (busy || !reading) return;
    begin("superdoc");
    setBusy("SuperDoc is proposing and verifying the redline…");
    setError("");
    try {
      const op = await measuredApply(
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
      setStale(false);
      setChanged([]);
      await navigate(id);
      if (op.warning) setError(op.warning);
    } catch (e) {
      setError(msg(e));
    } finally {
      finish();
      setBusy("");
    }
  }
  async function applyReady(humanApproved = false) {
    if (!reading || busy) return;
    begin("superdoc");
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
        .map((r) => r.id)
        .filter((id) => !guided || selectedProposals.includes(id));
      if ((await doc().info({})).revision !== current.revision)
        throw new Error("The document changed. Recheck before applying.");
      for (const id of ids) {
        const op = await measuredApply(
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
      setStale(false);
      setChanged([]);
      setStep(3);
      setSelected(ids[0] ?? "safeguard");
      setTab("document");
      await instance.current!.ui.viewport.scrollIntoView({
        target: {
          kind: "text",
          blockId: current.rows.find((r) => r.id === (ids[0] ?? "safeguard"))!
            .clause!.id,
          range: { start: 0, end: 0 },
        },
        block: "center",
        behavior: "instant",
      });
    } catch (e) {
      setError(msg(e));
      setReading(await readDocument(doc(), policy));
      setStep(3);
    } finally {
      finish();
      setBusy("");
    }
  }
  async function decide(op: Operation, choice: "accept" | "reject") {
    begin("superdoc");
    setBusy("Saving your review decision…");
    setError("");
    try {
      const updated = await decideOperation(doc(), op, choice);
      setOps((s) => s.map((o) => (o === op ? updated : o)));
      setReading(await readDocument(doc(), policy));
      if (updated.warning) setError(updated.warning);
      setStale(false);
    } catch (e) {
      setError(msg(e));
    } finally {
      finish();
      setBusy("");
    }
  }
  async function changeTerms(next: Policy) {
    if (busy) return;
    begin("superdoc");
    setBusy("Checking ownership of pending suggestions…");
    setError("");
    try {
      await clearOwned(doc(), ops, (resolved) =>
        setOps((s) => s.map((o) => (o.id === resolved.id ? resolved : o))),
      );
      setPolicy(next);
      setDeferred([]);
      setStep(1);
      setReading(await readDocument(doc(), next));
      setStale(true);
      setChanged(RULES.map((r) => r.id));
      setLastCheck(
        "Agreed terms changed. Recheck the current document; accepted changes remain.",
      );
    } catch (e) {
      setError(msg(e));
      setReading(await readDocument(doc(), policy));
    } finally {
      finish();
      setBusy("");
    }
  }
  async function editClause() {
    if (!reading) return;
    const row = reading.rows.find((r) => r.id === selected);
    if (!row?.clause) return;
    begin("superdoc");
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
      finish();
      setBusy("");
    }
  }
  async function requestDraft() {
    if (!reasoning || busy) return;
    begin("reasoning");
    setBusy("Reasoning model is drafting for human review…");
    setError("");
    let requested = false,
      reported = false;
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
      requested = true;
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
      if (result.usage) {
        meter.current.usage(
          result.model,
          result.usage,
          fresh.revision,
          `${VERSION}:${JSON.stringify(policy)}`,
        );
        reported = true;
      }
      setReasoned(result);
    } catch (e) {
      setError(msg(e));
    } finally {
      if (requested && !reported) meter.current.unknown();
      finish();
      setBusy("");
    }
  }
  async function proposeDraft() {
    if (!reasoned?.proposal || busy || !reading) return;
    begin("superdoc");
    setBusy("Proposing your approved draft…");
    setError("");
    try {
      const row = reading.rows.find((r) => r.id === "signals");
      if (
        row?.clause?.text !== reasoned.proposal.original ||
        row?.context !== reasoning?.clause.context ||
        policy.training !== "consent"
      )
        throw new Error("The clause or policy changed. Request a fresh draft.");
      const result = await measuredApply(
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
      setStale(false);
      if (!result.verified)
        throw new Error("Inspect the draft: verification did not pass.");
    } catch (e) {
      setError(msg(e));
    } finally {
      finish();
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
      !!currentDecision(r) &&
      currentDecision(r)?.verdict !== "ACCEPTABLE" &&
      currentDecision(r)?.verdict !== "NOT_APPLICABLE" &&
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
    if (op) return op.status === "accepted" ? "Accepted" : "Rejected";
    if (deferred.includes(r.id)) return "Human review later";
    if (r.problem) return "Needs context";
    if (cache[r.id] && !currentDecision(r)) return "Recheck";
    if (!currentDecision(r)) return "Not checked";
    if (r.id === "payment") return "Preserve";
    if (r.id === "liability" || r.id === "signals") return "Human decision";
    if (r.id === "safeguard" && !r.present) return "Not added yet";
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
  const queue = [
    ...new Set([...ops.map((o) => o.id), ...RULES.map((r) => r.id)]),
  ];
  const queueIndex = queue.indexOf(selected);
  const unresolved =
    reading?.rows.filter(
      (r) =>
        !ops.some((o) => o.id === r.id) &&
        (r.problem ||
          !currentDecision(r) ||
          !["ACCEPTABLE", "NOT_APPLICABLE"].includes(
            currentDecision(r)!.verdict,
          )),
    ).length ?? RULES.length;
  function nextFinding() {
    if (queueIndex < queue.length - 1) void navigate(queue[queueIndex + 1]);
    else setStep(4);
  }
  return (
    <div
      className={`deal-app ${guided ? `guided guided-step-${step}` : "free-explore"}`}
    >
      <header className="deal-header">
        <Link href="/" className="deal-brand">
          <span className="deal-logo">
            <FileText size={19} />
          </span>
          SuperDoc <span className="muted">×</span> Jev{" "}
          <span className="release-pill">GUIDED DEAL DESK · V4</span>
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
          <button
            disabled={!!busy || navigating}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} /> Open DOCX
          </button>
          <button
            disabled={!ready || !!busy || navigating}
            onClick={() => void download()}
          >
            <Download size={15} /> Download Word
          </button>
        </div>
      </section>
      <nav className="guide-progress" aria-label="Demo progress">
        {[
          "Review agreement",
          "Propose changes",
          "Review redlines",
          "Export",
        ].map((label, i) => (
          <button
            key={label}
            aria-current={guided && step === i + 1 ? "step" : undefined}
            disabled={
              !ready || !!busy || (i > 0 && i < 3 && !review && !ops.length)
            }
            onClick={() => {
              setGuided(true);
              setStep(i + 1);
              setTab("document");
            }}
          >
            <span>{i + 1}</span>
            {label}
          </button>
        ))}
        <button
          className="explore-toggle"
          disabled={!!busy || navigating}
          onClick={() => {
            setGuided(!guided);
            setTab("document");
          }}
        >
          {guided ? "Explore freely" : "Return to guided flow"}
        </button>
      </nav>
      <RunProof
        key={measurements.runId}
        measurement={measurements}
        getSnapshot={comparisonSnapshot}
        disabled={!ready || !!busy || navigating}
        inspect={() => {
          setGuided(false);
          setTab("developer");
        }}
      />
      <details className="supporting-settings" open={!guided || undefined}>
        <summary>Agreed terms & policy controls</summary>
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
              disabled={!ready || !!busy || navigating}
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
              disabled={!ready || !!busy || navigating}
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
      </details>
      <div className="deal-actionbar">
        <button
          className="primary"
          disabled={!ready || !!busy}
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
        {guided && (
          <aside className="guided-panel" aria-label="Guided instructions">
            <span className="eyebrow">STEP {step} OF 4</span>
            {step === 1 && (
              <>
                <h2>Review the returned agreement.</h2>
                <p>
                  You are Northstar’s developer, turning agreed commercial terms
                  into Meridian’s next Word counterproposal.
                </p>
                <ul>
                  <li>Require written consent for model training.</li>
                  <li>Set {policy.notice} days’ cancellation notice.</li>
                  <li>
                    Keep counsel’s payment concession and liability redline.
                  </li>
                </ul>
                <p>
                  Jev checks the clauses. SuperDoc applies approved language at
                  the correct Word locations.
                </p>
                <button
                  className="primary"
                  disabled={!ready || !!busy}
                  onClick={() => void check()}
                >
                  {busy ||
                    (stale && review
                      ? "Recheck changed clauses"
                      : "Review agreement")}
                </button>
                {error && (
                  <button
                    disabled={!ready || !!busy || navigating}
                    onClick={() => setStep(4)}
                  >
                    Continue to export without a new review
                  </button>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <h2>Approve the proposed language.</h2>
                <p>
                  Review each complete replacement below. Your approval creates
                  tracked suggestions you can still accept or reject.
                </p>
                {approvalRows.length === 0 && (
                  <p className="guide-empty">
                    No supported replacements are ready. Continue to inspect
                    existing redlines, missing terms and unresolved findings.
                  </p>
                )}
                {approvalRows.map((r) => (
                  <article className="guided-proposal" key={r.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedProposals.includes(r.id)}
                        onChange={(e) =>
                          setSelectedProposals((x) =>
                            e.target.checked
                              ? [...x, r.id]
                              : x.filter((id) => id !== r.id),
                          )
                        }
                      />
                      <b>{RULES.find((x) => x.id === r.id)!.label}</b>
                    </label>
                    <small>
                      {eligible(r, currentDecision(r))
                        ? "Eligible proposal · ≥95% Jev confidence"
                        : "Language requires your approval · below automatic threshold"}
                    </small>
                    <details>
                      <summary>Original clause</summary>
                      <del>{r.clause?.text}</del>
                    </details>
                    <ins>{r.replacement}</ins>
                  </article>
                ))}
                <p>
                  Missing safeguards need separate approval. Telemetry and
                  liability remain human decisions.
                </p>
                {approvalRows.some((r) => selectedProposals.includes(r.id)) ? (
                  <button
                    className="primary"
                    disabled={!!busy || stale}
                    onClick={() => void applyReady(true)}
                  >
                    {busy || "Approve selected language & create redlines"}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={!!busy || navigating}
                    onClick={() => {
                      setStep(3);
                      void navigate(queue[0]);
                    }}
                  >
                    Continue to findings
                  </button>
                )}
                <button
                  disabled={!!busy || navigating}
                  onClick={() => {
                    setStep(3);
                    void navigate(queue[0]);
                  }}
                >
                  Review findings without creating changes
                </button>
              </>
            )}
            {step === 3 && (
              <>
                <h2>Review each finding.</h2>
                <p>
                  Accept or reject in the panel beside the document. Missing and
                  ambiguous terms stay in this queue.
                </p>
                <ol className="guided-queue">
                  {queue.map((id) => (
                    <li key={id}>
                      <button
                        aria-current={selected === id ? "true" : undefined}
                        onClick={() => void navigate(id)}
                        disabled={!!busy || navigating}
                      >
                        <b>{RULES.find((r) => r.id === id)!.label}</b>
                        <small>
                          {reading?.rows.find((r) => r.id === id)
                            ? state(reading.rows.find((r) => r.id === id)!)
                            : "Unresolved"}
                        </small>
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  className="primary"
                  disabled={!!busy || navigating}
                  onClick={nextFinding}
                >
                  {queueIndex === queue.length - 1
                    ? "Continue to export"
                    : "Next finding"}
                </button>
                <button
                  disabled={!!busy || navigating}
                  onClick={() => setStep(4)}
                >
                  Continue to export with remaining items
                </button>
              </>
            )}
            {step === 4 && (
              <>
                <h2>Your Word counterproposal.</h2>
                <p>
                  The export includes your current document, counsel’s revisions
                  and any pending suggestions.
                </p>
                <dl className="export-counts">
                  <div>
                    <dt>Accepted</dt>
                    <dd>{ops.filter((o) => o.status === "accepted").length}</dd>
                  </div>
                  <div>
                    <dt>Rejected</dt>
                    <dd>{ops.filter((o) => o.status === "rejected").length}</dd>
                  </div>
                  <div>
                    <dt>Pending</dt>
                    <dd>{pending.length}</dd>
                  </div>
                  <div>
                    <dt>Unresolved findings</dt>
                    <dd>{unresolved}</dd>
                  </div>
                </dl>
                <p>
                  {pending.length || unresolved
                    ? "Pending changes and unresolved findings remain for the next reviewer. Exporting does not accept changes or settle open terms."
                    : "All findings have a review outcome."}
                </p>
                <button
                  className="primary"
                  disabled={!ready || !!busy || navigating}
                  onClick={() => void download()}
                >
                  {busy || "Download Word"}
                </button>
                <button
                  disabled={!!busy || navigating}
                  onClick={() => {
                    setStep(3);
                    void navigate(queue[0]);
                  }}
                >
                  Return to findings
                </button>
              </>
            )}
            {stale && step !== 1 && (
              <div className="guide-stale">
                <p>
                  Document or policy changed. Affected decisions need a fresh
                  check.
                </p>
                <button disabled={!!busy} onClick={() => void check()}>
                  Recheck changed clauses
                </button>
              </div>
            )}
          </aside>
        )}
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
              onClick={() => {
                setGuided(false);
                setTab("matrix");
              }}
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
                      className={`status-dot ${["Aligned", "Preserve", "Redline ready"].includes(status) ? "green" : ["Human decision", "Not added yet", "Recheck"].includes(status) ? "amber" : status === "Ready to redline" ? "blue" : ""}`}
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
            disabled={!!busy || navigating}
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
                onClick={() => {
                  setGuided(false);
                  setTab("matrix");
                }}
              >
                <Table2 size={14} /> Review matrix
              </button>
              <button
                className={tab === "developer" ? "active" : ""}
                onClick={() => {
                  setGuided(false);
                  setTab("developer");
                }}
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
                    disabled={!!busy || navigating}
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
        <aside className="finding-inspector" ref={inspector}>
          <div className="inspector-top">
            <span>SELECTED FINDING</span>
            <span>
              {RULES.findIndex((r) => r.id === selected) + 1} / {RULES.length}
            </span>
          </div>
          <span className="eyebrow">{rule.location}</span>
          <h2>{rule.label}</h2>
          {rule.kind === "insert" &&
            review &&
            !row?.present &&
            !row?.problem && (
              <section
                className="missing-safeguard"
                aria-label="Missing safeguard"
              >
                <b>Missing clause · Not added yet</b>
                <p>
                  Add the proposed language below as a new numbered item in
                  Schedule C, with a tracked insertion and comment.
                </p>
                <button
                  className="primary"
                  disabled={!!busy || navigating}
                  onClick={() => void apply(selected, true)}
                >
                  <GitPullRequest size={16} /> Add as tracked change
                </button>
              </section>
            )}
          {op?.status === "pending" ? (
            <div className="review-controls">
              <div className="verification">
                <ShieldCheck size={17} />
                <b>
                  {op.verified
                    ? op.kind === "insert"
                      ? "Numbered insertion tracked"
                      : "Tracked edit verified"
                    : "Inspect verification"}
                </b>
              </div>
              <p>
                {op.kind === "insert"
                  ? "New language is marked as an insertion in the document. Accept keeps the item; Reject removes it."
                  : "Text read back · Revision created · Counsel’s existing changes preserved"}
              </p>
              <div>
                <button
                  className="primary"
                  disabled={!!busy || navigating}
                  onClick={() => void decide(op, "accept")}
                >
                  <Check size={15} /> Accept
                </button>
                <button
                  disabled={!!busy || navigating}
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

          {op?.kind === "insert" &&
            op.status === "pending" &&
            op.commentId &&
            op.commentText && (
              <details className="safeguard-comment" open>
                <summary>
                  <MessageSquare size={15} /> Comment on the new item
                </summary>
                <p>{op.commentText}</p>
                <button
                  disabled={!!busy || navigating}
                  onClick={() => {
                    instance.current!.ui.comments.setActive(op.commentId!);
                    void instance.current!.ui.comments.scrollTo(op.commentId!);
                  }}
                >
                  Show commented text
                </button>
              </details>
            )}
          <details className="finding-rule" open={!guided || undefined}>
            <summary>Agreed instruction</summary>
            <p>{requirement(rule, policy)}</p>
          </details>
          {(decision || previous) && (
            <section
              className={`decision-card ${!decision && !op ? "stale" : ""}`}
            >
              <div>
                <span>
                  {decision
                    ? "JEV DECISION"
                    : op
                      ? "DECISION BEFORE THIS EDIT"
                      : "PREVIOUS DECISION · STALE"}
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
          {guided && !stale && !decision && previous && !op && (
            <button disabled={!!busy} onClick={() => void check()}>
              Recheck changed clauses
            </button>
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
                  disabled={!!busy || navigating}
                  onClick={() => void apply(selected, true)}
                >
                  Approve this replacement
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
                      Explore draft language for this unresolved term. You can
                      review it before creating a tracked change.
                    </p>
                    <button
                      disabled={!!busy || navigating}
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
                  disabled={!!busy || navigating}
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
          {guided && step === 3 && !op && rule.kind !== "preserve" && (
            <button
              disabled={!!busy || navigating}
              onClick={() => {
                setDeferred((x) => [...new Set([...x, selected])]);
                nextFinding();
              }}
            >
              Leave for human review
            </button>
          )}
          <button
            className="inspect-link"
            onClick={() => {
              setGuided(false);
              setTab("developer");
            }}
          >
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
        <Link href="/walkthrough#data-and-limits">Data & limits</Link>
      </footer>
    </div>
  );
}
