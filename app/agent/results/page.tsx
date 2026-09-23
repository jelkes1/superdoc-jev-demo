import Brand from "../../brand";
import summary from "@/docs/agent-summary.json";
import { LABELS, type Pipeline } from "@/lib/agent/types";
import "../workspace.css";
export const metadata = { title: "Document agent evaluation | SuperDoc × Jev" };
const root =
  "https://github.com/jelkes1/superdoc-jev-demo/blob/codex/superdoc-jev-demo/";
export default function AgentResults() {
  return (
    <main className="agent-app">
      <header className="agent-header">
        <Brand />
        <nav>
          <a href="/agent">Try the document agent →</a>
          <a href={root + "docs/agent-methodology.md"}>Methodology ↗</a>
        </nav>
      </header>
      <article className="agent-results">
        <span className="agent-eyebrow">A SMALL DEMONSTRATION DATASET</span>
        <h1>Where selection helps—and where it doesn’t.</h1>
        <p>
          60 genuine workflows. Three requests. Four approaches. The same
          drafting model and SuperDoc execution safeguards.
        </p>
        <div className="agent-result-notes">
          <section>
            <h2>Renewal: simpler is sufficient</h2>
            <p>
              Every approach met the frozen outcome in 5/5 runs. Keyword search
              was the least expensive here. Jev’s conservative selection
              retained most of this document and did not produce a time or cost
              win.
            </p>
          </section>
          <section>
            <h2>Training: context alone isn’t enough</h2>
            <p>
              Jev retained all required passages, while keyword search missed
              two. Every approach still missed a permission or proposed changes
              beyond the frozen scope. No training savings claim is made.
            </p>
          </section>
          <section>
            <h2>Names: clarify before drafting</h2>
            <p>
              All approaches asked about company-name scope. Interpretation
              stopped before selection or drafting in 5/5 runs. There were no
              Word edits to compare.
            </p>
          </section>
        </div>
        <h2>Measured results</h2>
        <p>
          Time is total active processing in seconds: median [minimum–maximum].
          Cost is mean estimated model spend per run, with reported cache
          discounts. Approval and editor startup are excluded. Outcome agreement
          uses frozen fixture assertions, not a legal-accuracy score.
        </p>
        <div className="agent-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Approach</th>
                <th>Processing, seconds</th>
                <th>Model cost / run</th>
                <th>Fixture agreement</th>
                <th>Median draft context</th>
                <th>Missed required passages*</th>
                <th>Fallbacks</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.task + r.pipeline}>
                  <td>{r.task}</td>
                  <td>{LABELS[r.pipeline as Pipeline]}</td>
                  <td>
                    {(r.latency.median / 1000).toFixed(2)} [
                    {(r.latency.min / 1000).toFixed(2)}–
                    {(r.latency.max / 1000).toFixed(2)}]
                  </td>
                  <td>{r.cost ? `$${r.cost.mean.toFixed(5)}` : "unknown"}</td>
                  <td>
                    {r.agreement}/{r.runs}
                  </td>
                  <td>{Math.round(r.context.median).toLocaleString()}</td>
                  <td>{r.missedContext}</td>
                  <td>
                    {r.fallbacks}/{r.runs}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          *Context misses summed across five repetitions. The training keyword
          row’s 10 misses are the same two passages in each repetition.
          First-edit times, ranges, schema tokens, cache usage and every
          response are in the retained results.
        </p>
        <h2>Held-out probes</h2>
        <p>
          One fresh call per case per approach, using separate, short fictional
          contexts. Planning checks only; these are not full Word workflows. Jev
          handled the paraphrase and conflicting-definition probes in this run;
          that is an example to investigate, not a general superiority claim.
        </p>
        <div className="agent-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Probe</th>
                {["full", "keyword", "jev", "interpret"].map((p) => (
                  <th key={p}>{LABELS[p as Pipeline]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                "reordered",
                "paraphrased",
                "missing",
                "conflicting-definitions",
                "ambiguous-companies",
              ].map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  {["full", "keyword", "jev", "interpret"].map((p) => (
                    <td key={p}>
                      {summary.heldOut.find(
                        (r) => r.case === c && r.pipeline === p,
                      )?.agreement
                        ? "Met expected outcome"
                        : "Did not meet outcome"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2>Reproduce and inspect</h2>
        <p>
          Jev 1.13.0 · GPT-5.4 mini 2026-03-17 · reasoning effort none ·
          SuperDoc 2.16.0. Pricing dated September 22, 2026. Formal evaluation
          reported ${summary.formalReportedUsd.toFixed(4)} in model spend; the
          pilot, formal evaluation and held-out checks reserved/reconciled $
          {summary.localSpendBoundUsd.toFixed(4)} of the $2 cap.
        </p>
        <p>
          One training keyword draft failed validation because it proposed
          multiple changes to the same block. All 60 exports reopened with
          tables, numbering, comments and counsel revisions preserved. Two
          representative exports were opened and saved in Microsoft Word for
          Mac, then reopened in SuperDoc.
        </p>
        <ul>
          <li>
            <a href={root + "docs/agent-evaluation-v1.json"}>
              All 60 results, usage, native Jev decisions and operation receipts
            </a>
          </li>
          <li>
            <a href={root + "docs/agent-held-out-v1.json"}>
              All 20 held-out responses
            </a>
          </li>
          <li>
            <a href={root + "docs/agent-export-verification.json"}>
              62 export checks, including native Word saves
            </a>
          </li>
          <li>
            <a href={root + "docs/agent-methodology.md"}>
              Methodology, limitations and frozen outcomes
            </a>
          </li>
          <li>
            <a href={root + "examples/document-agent.ts"}>
              Copyable TypeScript integration
            </a>
          </li>
        </ul>
        <pre>
          npm run eval:agent{"\n"}npm run eval:agent:held-out{"\n"}npm run
          verify:agent-exports
        </pre>
        <p>
          Historical decision and workflow comparisons remain separate. SuperDoc
          licensing, hosting and human time are not included in model-spend
          figures.
        </p>
      </article>
    </main>
  );
}
