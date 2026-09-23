import { reserve, type Identity } from "./budget";
import { PublicError } from "./validation";
import type { Pipeline } from "../agent/types";

const TTL = 10 * 60 * 1000;
export async function startAgent(
  db: D1Database,
  who: Identity,
  snapshot: string,
  maximum: Record<string, number>,
  limit: number,
) {
  await expireAgents(db);
  const r = await reserve(
    db,
    who,
    Object.values(maximum).reduce((a, b) => a + b, 0),
    limit,
    "compare",
    undefined,
    (r) => [
      db
        .prepare(
          "INSERT INTO agent_runs(id,snapshot,expires) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM reservations WHERE id=?)",
        )
        .bind(r.id, snapshot, Date.now() + TTL, r.id),
      ...[...new Set(Object.keys(maximum).map((k) => k.split(":")[0]))].map(
        (pipeline) =>
          db
            .prepare(
              "INSERT INTO agent_pipelines(run_id,pipeline) SELECT ?,? WHERE EXISTS(SELECT 1 FROM agent_runs WHERE id=?)",
            )
            .bind(r.id, pipeline, r.id),
      ),
      ...Object.keys(maximum).map((slot) =>
        db
          .prepare(
            "INSERT INTO agent_slots(run_id,slot,maximum) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM agent_runs WHERE id=?)",
          )
          .bind(r.id, slot, maximum[slot], r.id),
      ),
    ],
  );
  return { ...r, snapshot, expires: Date.now() + TTL };
}
export async function claimAgentCall(
  db: D1Database,
  who: Identity,
  id: string,
  snapshot: string,
  slot: string,
) {
  const r = await db
    .prepare(
      `UPDATE agent_slots SET state='started' WHERE run_id=? AND slot=? AND state='ready' AND EXISTS(SELECT 1 FROM agent_runs w JOIN reservations r ON r.id=w.id WHERE w.id=? AND w.snapshot=? AND w.closed=0 AND w.expires>? AND r.visitor=? AND r.ip=?)`,
    )
    .bind(id, slot, id, snapshot, Date.now(), who.visitor, who.ip)
    .run();
  if (r.meta.changes !== 1)
    throw new PublicError(
      "Comparison expired, changed, or this slot has already been requested.",
      409,
    );
}
export async function recordAgentUsage(
  db: D1Database,
  id: string,
  slot: string,
  costMicro: number | null,
) {
  if (costMicro !== null && (!Number.isSafeInteger(costMicro) || costMicro < 0))
    throw new Error("Invalid workflow usage");
  // Reconcile each provider independently. An unknown attempt retains its maximum.
  await db.batch([
    db
      .prepare(
        `UPDATE daily_budget SET reserved=reserved-(SELECT maximum-COALESCE(?,maximum) FROM agent_slots WHERE run_id=? AND slot=?) WHERE day=(SELECT day FROM reservations WHERE id=?) AND EXISTS(SELECT 1 FROM agent_slots WHERE run_id=? AND slot=? AND state='started')`,
      )
      .bind(costMicro, id, slot, id, id, slot),
    db
      .prepare(
        `UPDATE reservations SET amount=amount-(SELECT maximum-COALESCE(?,maximum) FROM agent_slots WHERE run_id=? AND slot=?) WHERE id=? AND EXISTS(SELECT 1 FROM agent_slots WHERE run_id=? AND slot=? AND state='started')`,
      )
      .bind(costMicro, id, slot, id, id, slot),
    db
      .prepare(
        "UPDATE agent_slots SET state='done',charged=? WHERE run_id=? AND slot=? AND state='started'",
      )
      .bind(costMicro, id, slot),
  ]);
}
async function close(db: D1Database, id: string) {
  // D1 transaction closes unclaimed slots before another caller can claim them.
  await db.batch([
    db
      .prepare(
        `UPDATE daily_budget SET reserved=reserved-COALESCE((SELECT SUM(maximum) FROM agent_slots WHERE run_id=? AND state='ready'),0) WHERE day=(SELECT day FROM reservations WHERE id=?)`,
      )
      .bind(id, id),
    db
      .prepare(
        `UPDATE reservations SET amount=amount-COALESCE((SELECT SUM(maximum) FROM agent_slots WHERE run_id=? AND state='ready'),0),settled=1 WHERE id=?`,
      )
      .bind(id, id),
    db
      .prepare(
        "UPDATE agent_slots SET state='closed',charged=0 WHERE run_id=? AND state='ready'",
      )
      .bind(id),
    db.prepare("UPDATE agent_runs SET closed=1 WHERE id=?").bind(id),
  ]);
}
export async function finishAgent(db: D1Database, who: Identity, id: string) {
  const r = await db
    .prepare(
      "SELECT w.id FROM agent_runs w JOIN reservations r ON r.id=w.id WHERE w.id=? AND r.visitor=? AND r.ip=?",
    )
    .bind(id, who.visitor, who.ip)
    .first();
  if (!r) throw new PublicError("Comparison not found.", 404);
  await close(db, id);
}
export async function expireAgents(db: D1Database) {
  const rows = await db
    .prepare(
      "SELECT id FROM agent_runs WHERE closed=0 AND expires<=? LIMIT 100",
    )
    .bind(Date.now())
    .all<{ id: string }>();
  for (const row of rows.results) await close(db, row.id);
}

export async function claimAgentPipeline(
  db: D1Database,
  who: Identity,
  id: string,
  snapshot: string,
  pipeline: Pipeline,
) {
  const r = await db
    .prepare(
      "UPDATE agent_pipelines SET claimed=1 WHERE run_id=? AND pipeline=? AND claimed=0 AND EXISTS(SELECT 1 FROM agent_runs w JOIN reservations r ON r.id=w.id WHERE w.id=? AND w.snapshot=? AND w.closed=0 AND w.expires>? AND r.visitor=? AND r.ip=?)",
    )
    .bind(id, pipeline, id, snapshot, Date.now(), who.visitor, who.ip)
    .run();
  if (r.meta.changes !== 1)
    throw new PublicError(
      "This pipeline was already requested, expired, or belongs to another snapshot.",
      409,
    );
}
