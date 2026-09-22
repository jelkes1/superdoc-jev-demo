import { reserve, type Identity } from "./budget";
import { PublicError } from "./validation";
import { MODELS, type CompareModel } from "../compare/types";

const TTL = 10 * 60 * 1000;
export async function startWorkflow(
  db: D1Database,
  who: Identity,
  snapshot: string,
  maximum: Record<CompareModel, number>,
  limit: number,
) {
  await expireWorkflows(db);
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
          "INSERT INTO workflow_runs(id,snapshot,expires) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM reservations WHERE id=?)",
        )
        .bind(r.id, snapshot, Date.now() + TTL, r.id),
      ...MODELS.map((model) =>
        db
          .prepare(
            "INSERT INTO workflow_slots(run_id,model,maximum) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM workflow_runs WHERE id=?)",
          )
          .bind(r.id, model, maximum[model], r.id),
      ),
    ],
  );
  return { ...r, snapshot, expires: Date.now() + TTL };
}
export async function claimModel(
  db: D1Database,
  who: Identity,
  id: string,
  snapshot: string,
  model: CompareModel,
) {
  const r = await db
    .prepare(
      `UPDATE workflow_slots SET state='started' WHERE run_id=? AND model=? AND state='ready' AND EXISTS(SELECT 1 FROM workflow_runs w JOIN reservations r ON r.id=w.id WHERE w.id=? AND w.snapshot=? AND w.closed=0 AND w.expires>? AND r.visitor=? AND r.ip=?)`,
    )
    .bind(id, model, id, snapshot, Date.now(), who.visitor, who.ip)
    .run();
  if (r.meta.changes !== 1)
    throw new PublicError(
      "Comparison expired, changed, or this model has already been requested.",
      409,
    );
}
export async function recordModelUsage(
  db: D1Database,
  id: string,
  model: CompareModel,
  costMicro: number | null,
) {
  if (costMicro !== null && (!Number.isSafeInteger(costMicro) || costMicro < 0))
    throw new Error("Invalid workflow usage");
  // Reconcile each provider independently. An unknown attempt retains its maximum.
  await db.batch([
    db
      .prepare(
        `UPDATE daily_budget SET reserved=reserved-(SELECT maximum-COALESCE(?,maximum) FROM workflow_slots WHERE run_id=? AND model=?) WHERE day=(SELECT day FROM reservations WHERE id=?) AND EXISTS(SELECT 1 FROM workflow_slots WHERE run_id=? AND model=? AND state='started')`,
      )
      .bind(costMicro, id, model, id, id, model),
    db
      .prepare(
        `UPDATE reservations SET amount=amount-(SELECT maximum-COALESCE(?,maximum) FROM workflow_slots WHERE run_id=? AND model=?) WHERE id=? AND EXISTS(SELECT 1 FROM workflow_slots WHERE run_id=? AND model=? AND state='started')`,
      )
      .bind(costMicro, id, model, id, id, model),
    db
      .prepare(
        "UPDATE workflow_slots SET state='done',charged=? WHERE run_id=? AND model=? AND state='started'",
      )
      .bind(costMicro, id, model),
  ]);
}
async function close(db: D1Database, id: string) {
  // D1 transaction closes unclaimed slots before another caller can claim them.
  await db.batch([
    db
      .prepare(
        `UPDATE daily_budget SET reserved=reserved-COALESCE((SELECT SUM(maximum) FROM workflow_slots WHERE run_id=? AND state='ready'),0) WHERE day=(SELECT day FROM reservations WHERE id=?)`,
      )
      .bind(id, id),
    db
      .prepare(
        `UPDATE reservations SET amount=amount-COALESCE((SELECT SUM(maximum) FROM workflow_slots WHERE run_id=? AND state='ready'),0),settled=1 WHERE id=?`,
      )
      .bind(id, id),
    db
      .prepare(
        "UPDATE workflow_slots SET state='closed',charged=0 WHERE run_id=? AND state='ready'",
      )
      .bind(id),
    db.prepare("UPDATE workflow_runs SET closed=1 WHERE id=?").bind(id),
  ]);
}
export async function finishWorkflow(
  db: D1Database,
  who: Identity,
  id: string,
) {
  const r = await db
    .prepare(
      "SELECT w.id FROM workflow_runs w JOIN reservations r ON r.id=w.id WHERE w.id=? AND r.visitor=? AND r.ip=?",
    )
    .bind(id, who.visitor, who.ip)
    .first();
  if (!r) throw new PublicError("Comparison not found.", 404);
  await close(db, id);
}
export async function expireWorkflows(db: D1Database) {
  const rows = await db
    .prepare(
      "SELECT id FROM workflow_runs WHERE closed=0 AND expires<=? LIMIT 100",
    )
    .bind(Date.now())
    .all<{ id: string }>();
  for (const row of rows.results) await close(db, row.id);
}
