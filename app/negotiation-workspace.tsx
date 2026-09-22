"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Brand from "./brand";
import type { SuperDoc as SuperDocInstance } from "superdoc";
import {
  FileText,
  ArrowUpRight,
  Download,
  ArrowRight,
  Check,
  X,
  RotateCcw,
  LoaderCircle,
  GitPullRequest,
  ShieldCheck,
  MessageSquare,
  ChevronRight,
  Code2,
  Pencil,
  AlertTriangle,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_POLICY,
  DEAL_VERSION,
  type DealPolicy,
  type DealReview,
  type LocationId,
} from "@/lib/negotiation/scenario";
import {
  snapshot,
  previewDeal,
  applyDeal,
  clearOwnProposal,
  staleLocations,
  canPropose,
  isAligned,
  type Snapshot,
  type AppliedDeal,
  type TrackedPlan,
  type ConnectedEdit,
} from "@/lib/negotiation/document";
import { validatePending } from "@/lib/review/document";

declare global {
  interface Window {
    __negotiation?: {
      instance: SuperDocInstance;
      snapshot: typeof snapshot;
      preview: typeof previewDeal;
      apply: typeof applyDeal;
      clear: typeof clearOwnProposal;
    };
  }
}
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "The operation could not be completed.";
function InlineDiff({ before, after }: { before: string; after: string }) {
  const a = before.split(/(\s+)/),
    b = after.split(/(\s+)/);
  // Word-level LCS for these bounded, short fallback clauses.
  const grid = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      grid[i][j] =
        a[i] === b[j]
          ? 1 + grid[i + 1][j + 1]
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
  const out: React.ReactNode[] = [];
  let i = 0,
    j = 0,
    k = 0;
  while (i < a.length || j < b.length) {
    if (a[i] === b[j] && i < a.length && j < b.length) {
      out.push(<span key={k++}>{a[i++]}</span>);
      j++;
    } else if (
      j < b.length &&
      (i === a.length || grid[i][j + 1] > grid[i + 1][j])
    )
      out.push(<ins key={k++}>{b[j++]}</ins>);
    else out.push(<del key={k++}>{a[i++]}</del>);
  }
  return <p className="clause-diff">{out}</p>;
}
export default function NegotiationWorkspace() {
  const mount = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    instance = useRef<SuperDocInstance | null>(null),
    generation = useRef(0);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [active, setActive] = useState<LocationId>("order");
  const [policy, setPolicy] = useState<DealPolicy>(DEFAULT_POLICY),
    [current, setCurrent] = useState<Snapshot | null>(null),
    [prepared, setPrepared] = useState<Snapshot | null>(null),
    [review, setReview] = useState<DealReview | null>(null),
    [plan, setPlan] = useState<TrackedPlan | null>(null),
    [applied, setApplied] = useState<AppliedDeal | null>(null);
  const [stale, setStale] = useState(false),
    [changed, setChanged] = useState<LocationId[]>([]),
    [manual, setManual] = useState<{
      edit: ConnectedEdit;
      text: string;
      revision: string;
    } | null>(null),
    [receipt, setReceipt] = useState<unknown>(null);
  const doc = () => {
    const d = instance.current?.activeEditor?.doc;
    if (!d) throw new Error("The document is still loading.");
    return d;
  };
  async function refresh() {
    const s = await snapshot(doc(), policy);
    setCurrent(s);
    return s;
  }
  async function open() {
    const ticket = ++generation.current;
    setReady(false);
    setNotice("");
    setPrepared(null);
    setPlan(null);
    setReview(null);
    setApplied(null);
    setStale(false);
    setManual(null);
    setReceipt(null);
    try {
      const { SuperDoc } = await import("superdoc");
      if (ticket !== generation.current) return;
      instance.current?.destroy();
      mount.current!.replaceChildren();
      document.getElementById("negotiation-toolbar")?.replaceChildren();
      const sd = new SuperDoc({
        selector: mount.current!,
        document: "/negotiation.docx",
        documentMode: "editing",
        role: "editor",
        user: {
          name: "Northstar · Document agent",
          email: "agent@example.invalid",
        },
        ui: {
          toolbar: {
            container: "#negotiation-toolbar",
            responsiveToContainer: true,
          },
          comments: { layout: "inline" },
          search: true,
          ruler: false,
        },
        zoom: {
          mode: "fit-width",
          fitWidth: { min: 25, max: 105, padding: 52 },
        },
        onReady: () => {
          if (ticket === generation.current) {
            void snapshot(sd.activeEditor!.doc!, DEFAULT_POLICY)
              .then((s) => {
                if (ticket === generation.current) {
                  setCurrent(s);
                  setReady(true);
                }
              })
              .catch((e) => setNotice(errorMessage(e)));
          }
        },
        onException: () =>
          setNotice(
            "The document reported an issue. Reload the sample if it cannot be edited.",
          ),
      });
      instance.current = sd;
      if (import.meta.env.DEV)
        // eslint-disable-next-line react-hooks/immutability -- Development-only bridge for real document integration tests.
        window.__negotiation = {
          instance: sd,
          snapshot,
          preview: previewDeal,
          apply: applyDeal,
          clear: clearOwnProposal,
        };
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }
  /* eslint-disable react-hooks/exhaustive-deps -- Own one editor lifecycle; invalidate unfinished loads. */
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void open();
    });
    return () => {
      cancelled = true;
      generation.current++;
      instance.current?.destroy();
      delete window.__negotiation;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!ready || !scroll.current) return;
    const el = scroll.current;
    let frame = 0;
    const center = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      });
    };
    const observer = new ResizeObserver(center);
    observer.observe(el);
    center();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ready]);
  // Detect ordinary typing and toolbar review decisions without blocking editing.
  useEffect(() => {
    if (!ready || busy) return;
    let cancelled = false;
    let reading = false;
    const timer = setInterval(async () => {
      if (reading) return;
      reading = true;
      try {
        const rev = (await doc().info({})).revision;
        if (current && rev !== current.revision) {
          const s = await snapshot(doc(), policy);
          if (cancelled) return;
          setCurrent(s);
          if (prepared && !applied && rev !== prepared.revision) {
            setStale(true);
            setChanged(
              prepared.edits
                .filter(
                  (e) =>
                    s.edits.find((x) => x.id === e.id)?.clause?.text !==
                    e.clause?.text,
                )
                .map((e) => e.id),
            );
          }
          if (applied) {
            const ids = new Set(s.changes.map((c) => c.id));
            setApplied({
              ...applied,
              suggestions: applied.suggestions.map((sug) => {
                if (sug.status !== "pending") return sug;
                const remaining = sug.verification.changeIds.filter((id) =>
                  ids.has(id),
                );
                const text = s.edits.find((e) => e.clause?.id === sug.clauseId)
                  ?.clause?.text;
                if (
                  remaining.length === sug.verification.changeIds.length &&
                  text === sug.proposal.replacement
                )
                  return sug;
                return {
                  ...sug,
                  status: remaining.length
                    ? "changed"
                    : text === sug.proposal.replacement
                      ? "accepted"
                      : text === sug.proposal.original
                        ? "rejected"
                        : "changed",
                };
              }),
            });
          }
        }
      } catch {
        /* A concurrent editor transaction is retried at the next tick. */
      } finally {
        reading = false;
      }
    }, 1200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, busy, current, policy, prepared, applied]);
  async function navigate(e: ConnectedEdit) {
    if (!e.clause) return;
    setActive(e.id);
    const r = await instance.current!.ui.viewport.scrollIntoView({
      target: {
        kind: "text",
        blockId: e.clause.nodeId,
        range: { start: 0, end: 0 },
      },
      block: "center",
      behavior: "instant",
    });
    if (!r.success)
      setNotice("That location has changed. Prepare a fresh proposal.");
  }
  async function prepare() {
    if (busy) return;
    setBusy("Reading the agreement…");
    setNotice("");
    setPlan(null);
    setManual(null);
    try {
      await clearOwnProposal(doc(), applied);
      setApplied(null);
      setReceipt(null);
      setPrepared(null);
      setReview(null);
      const s = await refresh();
      setStale(false);
      setChanged([]);
      if (s.edits.some((e) => !e.clause || e.problem))
        throw new Error(
          "The guided negotiation needs all three original locations. Missing or duplicate locations require manual review.",
        );
      setBusy("Jev is reviewing the connected clauses…");
      const response = await fetch("/api/negotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: DEAL_VERSION,
          revision: s.revision,
          policy,
          locations: s.edits.map((e) => ({ id: e.id, clause: e.clause })),
        }),
      });
      const body = (await response.json()) as DealReview & { error?: string };
      if (!response.ok) throw new Error(body.error || "Live review failed.");
      const result = body as DealReview;
      const reviewed = {
        ...s,
        edits: s.edits.map((e) => ({
          ...e,
          decision: result.decisions.find((d) => d.locationId === e.id),
        })),
      };
      setReview(result);
      setPrepared(reviewed);
      const check = await staleLocations(doc(), s, policy);
      setCurrent(check.fresh);
      if (check.stale) {
        setStale(true);
        setChanged(check.changed);
        setNotice(
          "Your document changed during review. Your edits are preserved. Review the current text before applying.",
        );
      } else if (reviewed.edits.every((e) => canPropose(e) || isAligned(e))) {
        if (reviewed.edits.some(canPropose)) {
          const p = await previewDeal(doc(), reviewed);
          setPlan(p.plan);
          setReceipt(p.preview);
        }
      }
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function apply() {
    if (!prepared || !plan || busy) return;
    setBusy("Checking current targets…");
    setNotice("");
    try {
      const check = await staleLocations(doc(), prepared, policy);
      if (check.stale) {
        setCurrent(check.fresh);
        setStale(true);
        setChanged(check.changed);
        throw new Error(
          "Proposal paused: the document changed after review. Your edit is intact. Review the current text before applying.",
        );
      }
      setBusy("Creating tracked changes…");
      const result = await applyDeal(doc(), prepared, plan);
      setApplied(result);
      setReceipt(result.receipt);
      setPlan(null);
      setNotice(result.warnings.join(" "));
      await refresh();
      const first = prepared.edits.find((e) => e.id === "body")!;
      await navigate(first);
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function decideExisting(
    edit: ConnectedEdit,
    decision: "accept" | "reject",
  ) {
    setBusy("Recording your decision…");
    setNotice("");
    try {
      const fresh = await refresh(),
        location = fresh.edits.find((e) => e.id === edit.id)!;
      if (!location.existing.length)
        throw new Error(
          "This change was already resolved. Review the current text.",
        );
      const r = await doc().trackChanges.decide(
        {
          decision,
          target: { kind: "ids", ids: location.existing.map((c) => c.id) },
        },
        { expectedRevision: fresh.revision },
      );
      if (!r.success)
        throw new Error(r.failure?.message ?? "The document operation failed.");
      setStale(true);
      setChanged([edit.id]);
      setPlan(null);
      await refresh();
      setNotice(
        "Your decision is recorded. Review the current text to refresh the connected proposal.",
      );
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function decideOwn(id: string, decision: "accept" | "reject") {
    if (!applied) return;
    setBusy("Recording your decision…");
    setNotice("");
    try {
      await validatePending(doc(), applied.suggestions);
      const s = applied.suggestions.find((x) => x.decisionId === id)!;
      const r = await doc().trackChanges.decide(
        { decision, target: { kind: "ids", ids: s.verification.changeIds } },
        { expectedRevision: (await doc().info({})).revision },
      );
      if (!r.success)
        throw new Error(r.failure?.message ?? "The document operation failed.");
      setApplied({
        ...applied,
        suggestions: applied.suggestions.map((x) =>
          x === s
            ? { ...x, status: decision === "accept" ? "accepted" : "rejected" }
            : x,
        ),
      });
      await refresh();
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function approveFallback(edit: ConnectedEdit) {
    if (!prepared) return;
    setNotice("");
    const next = {
      ...prepared,
      edits: prepared.edits.map((e) =>
        e.id === edit.id ? { ...e, humanApproved: true } : e,
      ),
    };
    setPrepared(next);
    if (
      next.edits.some(canPropose) &&
      next.edits.every((e) => canPropose(e) || isAligned(e))
    )
      try {
        const p = await previewDeal(doc(), next);
        setPlan(p.plan);
        setReceipt(p.preview);
      } catch (e) {
        setNotice(errorMessage(e));
      }
  }
  async function editClause(e: ConnectedEdit) {
    try {
      const fresh = await refresh();
      const edit = fresh.edits.find((x) => x.id === e.id)!;
      if (edit.existing.length)
        throw new Error(
          "Resolve the pending tracked changes in this clause before making a direct edit.",
        );
      if (!edit.clause) throw new Error("This clause could not be found.");
      setManual({ edit, text: edit.clause.text, revision: fresh.revision });
      await navigate(edit);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }
  async function saveManual() {
    if (!manual) return;
    setBusy("Saving your edit…");
    setNotice("");
    try {
      const c = manual.edit.clause!;
      if (!manual.text.trim() || manual.text.length > 5000)
        throw new Error("Enter a clause between 1 and 5,000 characters.");
      const m = await doc().query.match({
        select: { type: "text", pattern: c.text, caseSensitive: true },
        within: { kind: "block", nodeId: c.nodeId, nodeType: c.nodeType },
        require: "exactlyOne",
      });
      if (m.items[0]?.matchKind !== "text")
        throw new Error("The clause changed. Open the current text again.");
      const r = await doc().replace(
        { target: m.items[0].target, text: manual.text },
        { changeMode: "direct", expectedRevision: manual.revision },
      );
      if (!r.success)
        throw new Error(r.failure?.message ?? "The document operation failed.");
      setManual(null);
      await refresh();
      if (prepared) {
        setStale(true);
        setChanged([manual.edit.id]);
      }
      setNotice(
        "Your edit is saved in the document. The earlier proposal must be reviewed again.",
      );
    } catch (e) {
      setNotice(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function download() {
    try {
      await instance.current?.export({
        isFinalDoc: false,
        exportedName: "northstar-counterproposal",
      });
    } catch (e) {
      setNotice(errorMessage(e));
    }
  }
  const edits = prepared?.edits ?? current?.edits ?? [];
  const conflicts = edits.filter(
    (e) =>
      (current?.edits.find((c) => c.id === e.id)?.existing.length ??
        e.existing.length) > 0 && !applied,
  ).length;
  const inconsistent = !!applied?.suggestions.some(
    (s) => s.status === "rejected" || s.status === "changed",
  );
  const unchanged =
    current?.changes.filter(
      (c) =>
        !applied?.suggestions.some((s) =>
          s.verification.changeIds.includes(c.id),
        ),
    ).length ?? 0;
  return (
    <main className="workspace negotiation">
      <header className="topbar">
        <Brand />
        <span className="edition">THE NEGOTIATION LAB</span>
        <nav>
          <Link href="/playbook">Playbook review</Link>
          <a
            href="https://github.com/jelkes1/superdoc-jev-demo"
            target="_blank"
            rel="noreferrer"
          >
            View source <ArrowUpRight size={15} />
          </a>
        </nav>
      </header>
      <section className="negotiation-heading">
        <div>
          <div className="eyebrow">
            ONE DECISION. THREE CONNECTED LOCATIONS.
          </div>
          <h1>
            A counterproposal.
            <br className="mobile-break" /> In the actual document.
          </h1>
          <p>Jev evaluates. SuperDoc redlines. You negotiate.</p>
        </div>
        <Button
          variant="outline"
          disabled={!ready || !!busy}
          onClick={() => void download()}
        >
          <Download size={16} />
          Download Word
        </Button>
      </section>
      <div className="negotiation-bench">
        <section className="document-pane">
          <div className="document-tab">
            <FileText size={16} />
            <strong>Northstar × Meridian</strong>
            <span className="filetag">DOCX</span>
            <button
              className="sample-button"
              disabled={!!busy}
              onClick={() => void open()}
              title="Discard current edits and reopen the sample"
            >
              <RotateCcw size={14} />
              Reset sample
            </button>
          </div>
          <div className="negotiation-history">
            <span>
              <GitPullRequest size={14} />
              {current
                ? `${unchanged} existing revisions`
                : "Opening negotiation…"}
            </span>
            <span>
              <MessageSquare size={14} />
              {current?.comments ?? "—"} comments
            </span>
            <span className="history-local">DOCX stays in your browser</span>
          </div>
          <div id="negotiation-toolbar" />
          <div className="document-scroll" ref={scroll}>
            <div ref={mount} id="negotiation-editor" />
          </div>
          <div className="document-foot">
            <span>
              <ShieldCheck size={14} />
              Existing negotiation history stays in the file
            </span>
            <span>Fictional agreement</span>
          </div>
        </section>
        <aside className="deal-pane">
          <div className="deal-scroll">
            <div className="deal-kicker">
              <GitPullRequest size={15} />
              COUNTERPROPOSAL <span>Northstar · Vendor</span>
            </div>
            <h2>
              Bring the terms <br />
              into agreement.
            </h2>
            <div className="deal-instruction">
              <div className="deal-label">YOUR NEGOTIATION INSTRUCTIONS</div>
              <p>
                Align the liability terms across the agreement, order form, and
                data schedule. Preserve the other negotiated changes.
              </p>
              <div className="cap-controls">
                <label>
                  General cap
                  <select
                    aria-label="General cap"
                    disabled={!!busy}
                    value={policy.general}
                    onChange={(e) => {
                      setPolicy({
                        ...policy,
                        general: Number(e.target.value) as 12 | 24,
                      });
                      setStale(!!prepared);
                      setPlan(null);
                    }}
                  >
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                  </select>
                </label>
                <label>
                  Data-protection cap
                  <select
                    aria-label="Data-protection cap"
                    disabled={!!busy}
                    value={policy.data}
                    onChange={(e) => {
                      setPolicy({
                        ...policy,
                        data: Number(e.target.value) as 24 | 36,
                      });
                      setStale(!!prepared);
                      setPlan(null);
                    }}
                  >
                    <option value="24">24 months</option>
                    <option value="36">36 months</option>
                  </select>
                </label>
              </div>
              <span className="deal-footnote">
                Of fees · Supplied fallback language
              </span>
            </div>
            {!prepared && !busy && (
              <p className="negotiation-hint">
                Counsel returned this agreement with edits. Prepare a connected
                proposal, resolve the overlap, then review the redlines.
              </p>
            )}
            {notice && (
              <div className="deal-alert" role="alert">
                <AlertTriangle size={16} />
                <span>{notice}</span>
              </div>
            )}
            {stale && prepared && (
              <div className="stale-banner">
                <ShieldCheck size={18} />
                <div>
                  <strong>Your work is protected.</strong>
                  <p>
                    {changed.length
                      ? `${changed.map((id) => edits.find((e) => e.id === id)?.label).join(", ")} changed.`
                      : "The document or instructions changed."}{" "}
                    The earlier proposal is out of date.
                  </p>
                </div>
              </div>
            )}
            {inconsistent && (
              <div className="deal-alert">
                <Link2 size={16} />
                <span>
                  These locations are no longer aligned with the full proposal.
                  Review the remaining differences before returning the
                  agreement.
                </span>
              </div>
            )}
            <div className="connected-title">
              <span>
                <Link2 size={15} />
                Connected locations
              </span>
              <span>
                {edits.length} locations
                {conflicts ? ` · ${conflicts} overlap` : ""}
              </span>
            </div>
            <div className="connected-edits">
              {edits.map((e, index) => {
                const now = current?.edits.find((c) => c.id === e.id) ?? e;
                const own = applied?.suggestions.find(
                  (s) => s.decisionId === e.id,
                );
                const conflict = !applied && now.existing.length > 0;
                const same = isAligned(e);
                const state = own
                  ? own.status === "pending"
                    ? "Redline verified"
                    : own.status === "accepted"
                      ? "Accepted"
                      : own.status === "rejected"
                        ? "Rejected"
                        : "Review needed"
                  : stale && prepared
                    ? "Source changed"
                    : conflict
                      ? "Counsel overlap"
                      : prepared
                        ? same
                          ? "Already aligned"
                          : canPropose(e)
                            ? "Ready to propose"
                            : "Needs judgment"
                        : "To review";
                return (
                  <article
                    className={`connected-card ${active === e.id ? "is-active" : ""}`}
                    key={e.id}
                    data-location={e.id}
                  >
                    <button
                      className="location-button"
                      onClick={() => void navigate(now)}
                      disabled={!ready}
                    >
                      <span className="location-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{e.label}</strong>
                        <small>{e.reference}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                    <div
                      className={`location-state ${conflict ? "has-conflict" : own?.status === "pending" || own?.status === "accepted" ? "is-verified" : ""}`}
                    >
                      <span>
                        {own?.status === "pending" ||
                        own?.status === "accepted" ? (
                          <Check size={13} />
                        ) : conflict ? (
                          <AlertTriangle size={13} />
                        ) : (
                          <Link2 size={13} />
                        )}{" "}
                        {state}
                      </span>
                      {e.decision && (
                        <span>
                          Jev · {Math.round(e.decision.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    {active === e.id && (
                      <div className="location-detail">
                        {e.problem ? (
                          <p>{e.problem}</p>
                        ) : prepared && e.replacement && e.clause ? (
                          <InlineDiff
                            before={e.clause.text}
                            after={e.replacement}
                          />
                        ) : (
                          <p className="clause-diff">{now.clause?.text}</p>
                        )}
                        {conflict && (
                          <div className="counsel-overlap">
                            <strong>
                              Counsel has an unresolved edit here.
                            </strong>
                            <p>
                              {now.existing
                                .map(
                                  (c) =>
                                    `${c.deletedText ?? ""} → ${c.insertedText ?? ""}`,
                                )
                                .join("; ")}
                              . Decide on that edit before applying the
                              fallback.
                            </p>
                            <div className="card-actions">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!!busy}
                                onClick={() =>
                                  void decideExisting(now, "accept")
                                }
                              >
                                Accept counsel’s edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!!busy}
                                onClick={() =>
                                  void decideExisting(now, "reject")
                                }
                              >
                                Reject counsel’s edit
                              </Button>
                            </div>
                          </div>
                        )}
                        {own?.status === "pending" && (
                          <div className="card-actions">
                            <Button
                              size="sm"
                              disabled={!!busy}
                              onClick={() => void decideOwn(e.id, "accept")}
                            >
                              <Check size={14} />
                              Accept change
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!!busy}
                              onClick={() => void decideOwn(e.id, "reject")}
                            >
                              <X size={14} />
                              Reject change
                            </Button>
                          </div>
                        )}
                        {prepared &&
                          !own &&
                          !conflict &&
                          !stale &&
                          !same &&
                          !canPropose(e) &&
                          e.replacement && (
                            <div className="human-fallback">
                              <p>
                                Jev left this unresolved. Review the supplied
                                fallback yourself before proposing it.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void approveFallback(e)}
                              >
                                I reviewed this fallback
                              </Button>
                            </div>
                          )}
                        {!own && !conflict && (
                          <button
                            className="text-action"
                            disabled={!!busy}
                            onClick={() => void editClause(now)}
                          >
                            <Pencil size={13} />
                            Edit this clause yourself
                          </button>
                        )}
                        {e.decision && (
                          <details className="decision-detail">
                            <summary>Jev’s actual response</summary>
                            <p>
                              {e.decision.verdict} · Confidence{" "}
                              {Math.round(e.decision.confidence * 100)}%
                            </p>
                            {Object.entries(e.decision.probabilities).map(
                              ([key, value]) => (
                                <div className="probability" key={key}>
                                  <span>
                                    {key.toLowerCase().replaceAll("_", " ")}
                                  </span>
                                  <span>{(value * 100).toFixed(1)}%</span>
                                </div>
                              ),
                            )}
                            <small>
                              {e.decision.model} · Confidence is not a guarantee
                              of correctness.
                            </small>
                          </details>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {manual && (
              <div className="manual-edit">
                <h3>Your edit · {manual.edit.label}</h3>
                <p>
                  This saves a direct edit in the Word document. Try changing a
                  cap after preparing the proposal.
                </p>
                <textarea
                  aria-label="Your clause edit"
                  value={manual.text}
                  onChange={(e) =>
                    setManual({ ...manual, text: e.target.value })
                  }
                />
                <div className="card-actions">
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => void saveManual()}
                  >
                    Save my edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManual(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {applied?.verified && (
              <div className="verified-note">
                <ShieldCheck size={18} />
                <div>
                  <strong>
                    {applied.suggestions.length} document locations verified
                  </strong>
                  <p>
                    Tracked changes created. Existing revisions preserved.{" "}
                    {applied.comments.length} anchored explanations added.
                  </p>
                </div>
              </div>
            )}
            {review && (
              <div className="run-metrics">
                <span>{review.usage.decisions} live judgments</span>
                <span>{(review.usage.latencyMs / 1000).toFixed(2)}s</span>
                <span>
                  {review.usage.inputTokens.toLocaleString()} input tokens
                </span>
                <span>${review.usage.costUsd.toFixed(5)}</span>
              </div>
            )}
            <details className="developer-proof">
              <summary>
                <Code2 size={15} />
                How this was applied
              </summary>
              <p>
                Jev returns judgments. Application code checks targets and
                document state. SuperDoc executes tracked operations and returns
                receipts.
              </p>
              <ol>
                <li>Read the three clauses from the actual document.</li>
                <li>Evaluate against the supplied deal instructions.</li>
                <li>Resolve overlap and guard the document revision.</li>
                <li>Preview and apply a tracked mutation plan.</li>
                <li>Verify resulting text, revisions, and retained history.</li>
              </ol>
              {!!receipt && (
                <pre>
                  {JSON.stringify(
                    {
                      revision: prepared?.revision,
                      version: DEAL_VERSION,
                      receipt,
                    },
                    null,
                    2,
                  )}
                </pre>
              )}
              <Link href="/walkthrough">
                Read the developer walkthrough <ArrowUpRight size={13} />
              </Link>
            </details>
          </div>
          <div className="deal-bottom">
            {plan && !applied && (
              <Button
                className="apply-deal"
                disabled={!!busy}
                onClick={() => void apply()}
              >
                <GitPullRequest size={16} />
                {stale
                  ? "Check proposal against current text"
                  : `Propose ${prepared?.edits.filter(canPropose).length} connected changes`}
                <ArrowRight size={16} />
              </Button>
            )}
            <Button
              className="prepare-deal"
              variant={plan && !stale ? "outline" : "default"}
              disabled={!ready || !!busy}
              onClick={() => void prepare()}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}{" "}
              {busy ||
                (!prepared
                  ? "Prepare counterproposal"
                  : stale
                    ? "Review current text"
                    : applied
                      ? "Review again"
                      : "Rerun review")}
            </Button>
            <p>
              <a href="/walkthrough#data-and-limits">Data & limits</a>
            </p>
          </div>
        </aside>
      </div>
      <footer className="negotiation-footer">
        <span>
          Guided fictional negotiation · Three known locations · Human review
          required
        </span>
        <Link href="/playbook">
          Try the five-rule playbook on your own DOCX <ArrowUpRight size={13} />
        </Link>
      </footer>
    </main>
  );
}
