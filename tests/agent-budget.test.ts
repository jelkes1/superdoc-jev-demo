import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import {
  startAgent,
  claimAgentPipeline,
  claimAgentCall,
  recordAgentUsage,
  finishAgent,
  expireAgents,
} from "../lib/server/agent-budget";
import { MODELS } from "../lib/compare/types";
const who = { visitor: "v", ip: "i", cookie: null };
const parts = Object.fromEntries(MODELS.map((m) => [m, 100])) as Record<
  (typeof MODELS)[number],
  number
>;
async function database() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ["DB"],
  });
  const db = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const f of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(
      (await readFile(`drizzle/${f}`, "utf8"))
        .replaceAll("--> statement-breakpoint", "")
        .replaceAll("\n", " "),
    );
  }
  return { mf, db };
}
const balance = async (db: D1Database) =>
  (await db
    .prepare("SELECT reserved FROM daily_budget")
    .first<{ reserved: number }>())!.reserved;
test("agent combined reservations share limits and atomic single-use model slots", async () => {
  const { mf, db } = await database();
  try {
    const attempts = await Promise.allSettled(
      Array.from({ length: 9 }, () => startAgent(db, who, "s", parts, 10000)),
    );
    const good = attempts.filter(
      (
        r,
      ): r is PromiseFulfilledResult<Awaited<ReturnType<typeof startAgent>>> =>
        r.status === "fulfilled",
    );
    assert.equal(good.length, 5);
    assert.equal(await balance(db), 1500);
    const id = good[0].value.id;
    await assert.rejects(
      claimAgentCall(db, { ...who, visitor: "other" }, id, "s", MODELS[0]),
    );
    await assert.rejects(claimAgentCall(db, who, id, "changed", MODELS[0]));
    const claims = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        claimAgentCall(db, who, id, "s", MODELS[0]),
      ),
    );
    assert.equal(claims.filter((x) => x.status === "fulfilled").length, 1);
    await Promise.all([
      recordAgentUsage(db, id, MODELS[0], 20),
      recordAgentUsage(db, id, MODELS[0], 20),
    ]);
    assert.equal(await balance(db), 1420);
    await claimAgentCall(db, who, id, "s", MODELS[1]);
    await recordAgentUsage(db, id, MODELS[1], null);
    await Promise.all([finishAgent(db, who, id), finishAgent(db, who, id)]);
    assert.equal(await balance(db), 1320);
    await assert.rejects(claimAgentCall(db, who, id, "s", MODELS[2]));
  } finally {
    await mf.dispose();
  }
});
test("expiry closes unused slots, retains in-flight unknowns, and safely reconciles late usage", async () => {
  const { mf, db } = await database();
  try {
    const r = await startAgent(db, who, "s", parts, 300);
    await claimAgentCall(db, who, r.id, "s", MODELS[0]);
    await db
      .prepare("UPDATE agent_runs SET expires=0 WHERE id=?")
      .bind(r.id)
      .run();
    await expireAgents(db);
    assert.equal(await balance(db), 100);
    await recordAgentUsage(db, r.id, MODELS[0], 10);
    assert.equal(await balance(db), 10);
    await finishAgent(db, who, r.id);
    assert.equal(await balance(db), 10);
    const many = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        startAgent(
          db,
          { ...who, visitor: `v${i}`, ip: `i${i}` },
          "s",
          parts,
          600,
        ),
      ),
    );
    assert.equal(many.filter((r) => r.status === "fulfilled").length, 1);
  } finally {
    await mf.dispose();
  }
});

test("pipeline claims bind visitor, snapshot, and one request independently of provider slots", async () => {
  const { mf, db } = await database();
  try {
    const r = await startAgent(
      db,
      who,
      "frozen",
      { "jev:select:0": 100, "jev:draft": 100 },
      1000,
    );
    await assert.rejects(
      claimAgentPipeline(db, { ...who, ip: "other" }, r.id, "frozen", "jev"),
    );
    await assert.rejects(claimAgentPipeline(db, who, r.id, "changed", "jev"));
    const claims = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        claimAgentPipeline(db, who, r.id, "frozen", "jev"),
      ),
    );
    assert.equal(claims.filter((c) => c.status === "fulfilled").length, 1);
    await finishAgent(db, who, r.id);
    assert.equal(await balance(db), 0);
    await assert.rejects(claimAgentPipeline(db, who, r.id, "frozen", "full"));
  } finally {
    await mf.dispose();
  }
});
