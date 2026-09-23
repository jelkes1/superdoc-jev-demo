"use client";
import { useState } from "react";
import { type Lane, totalCost, savings } from "@/lib/agent/types";
import { equivalentLanes } from "@/lib/agent/evaluation";
export default function ComparisonProof({
  lanes,
  fixture,
}: {
  lanes: Lane[];
  fixture: boolean;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const a = lanes.find((l) => l.pipeline === "jev"),
    b = lanes.find((l) => l.pipeline === "full");
  if (!a || !b) return null;
  const edits = (l: Lane) =>
    l.executions.filter((e) => e.verified && e.edit.tool === "replace");
  const key = (l: Lane) =>
    edits(l)
      .map((e) => e.edit.blockId)
      .sort()
      .join(",");
  const allApproved = (l: Lane) =>
    l.result?.plan.edits.length === l.executions.length &&
    !l.result?.plan.unresolved.length;
  const comparable =
    edits(a).length > 0 &&
    key(a) === key(b) &&
    [a, b].every(
      (l) =>
        !l.failed &&
        allApproved(l) &&
        l.executions.every((e) => e.verified && e.preserved),
    );
  const equivalent = fixture ? equivalentLanes(a, b) : comparable && confirmed;
  const time =
    equivalent && a.timingValid && b.timingValid
      ? savings(
          b.extractionMs + b.planningMs + b.executionMs,
          a.extractionMs + a.planningMs + a.executionMs,
        )
      : null;
  const cost = equivalent
    ? savings(totalCost(b.result), totalCost(a.result))
    : null;
  return (
    <section className="agent-outcome-proof">
      <h3>Jev selection vs full context</h3>
      <p>
        Equivalent verified outcome:{" "}
        <b>
          {equivalent
            ? fixture
              ? "fixture checks passed"
              : "confirmed by reviewer"
            : "not established"}
        </b>
      </p>
      {!fixture && comparable && (
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I inspected both outputs: the requested changes and preserved terms
          match.
        </label>
      )}
      {!equivalent && (
        <p className="agent-muted">
          Approve and inspect both copies first. Different or incomplete
          outcomes have no savings headline.
        </p>
      )}
      {equivalent && (
        <div className="agent-savings">
          <div>
            <strong>
              {time
                ? `${(Math.abs(time.absolute) / 1000).toFixed(2)}s ${time.absolute >= 0 ? "saved" : "longer"}`
                : "Time unavailable"}
            </strong>
            <span>
              {time
                ? `${Math.abs(time.percent).toFixed(1)}% ${time.absolute >= 0 ? "shorter" : "longer"} processing`
                : "The page was backgrounded during measurement."}
            </span>
          </div>
          <div>
            <strong>
              {cost
                ? `$${Math.abs(cost.absolute).toFixed(5)} ${cost.absolute >= 0 ? "saved" : "more"}`
                : "Cost unavailable"}
            </strong>
            <span>
              {cost
                ? `${Math.abs(cost.percent).toFixed(1)}% ${cost.absolute >= 0 ? "lower" : "higher"} estimated model spend`
                : "Usage is unknown or the denominator is zero."}
            </span>
          </div>
        </div>
      )}
      <p className="agent-muted">
        Same drafting model; selection and interpretation costs included.
        Document verification is not legal accuracy. Licensing, hosting and
        human review are excluded.
      </p>
      <a href="/agent/results">Read the 60-workflow evaluation ↗</a>
    </section>
  );
}
