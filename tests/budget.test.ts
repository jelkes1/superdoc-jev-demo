import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readFile } from "node:fs/promises";
import { reserve, settle, type Identity } from "../lib/server/budget";
async function database() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    d1Databases: ["DB"],
  });
  const db = await mf.getD1Database("DB");
  const sql = await readFile(
    new URL("../drizzle/0000_motionless_brood.sql", import.meta.url),
    "utf8",
  );
  await db.exec(
    sql.replaceAll("--> statement-breakpoint", "").replaceAll("\n", " "),
  );
  return { mf, db: db as unknown as D1Database };
}
const who: Identity = { visitor: "visitor", ip: "ip", cookie: null };
test("concurrent reservations cannot exceed shared daily allowance", async () => {
  const { mf, db } = await database();
  try {
    const result = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        reserve(
          db,
          { ...who, visitor: `v${i}`, ip: `i${i}` },
          300,
          1000,
          "review",
        ),
      ),
    );
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 3);
    const row = await db
      .prepare("SELECT reserved FROM daily_budget")
      .first<{ reserved: number }>();
    assert.equal(row!.reserved, 900);
  } finally {
    await mf.dispose();
  }
});
test("visitor and IP limits, idempotent settlement, two reasoning calls", async () => {
  const { mf, db } = await database();
  try {
    const reservations = await Promise.allSettled(
      Array.from({ length: 8 }, () => reserve(db, who, 100, 10000, "review")),
    );
    const good = reservations
      .filter((r) => r.status === "fulfilled")
      .map(
        (r) =>
          (r as PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>>)
            .value,
      );
    assert.equal(good.length, 5);
    await assert.rejects(
      reserve(db, { ...who, visitor: "new-cookie" }, 100, 10000, "review"),
    );
    await settle(db, good[0], 30);
    await settle(db, good[0], 30);
    assert.equal(
      (await db
        .prepare("SELECT reserved FROM daily_budget")
        .first<{ reserved: number }>())!.reserved,
      430,
    );
    const reasons = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        reserve(db, who, 100, 10000, "reason", good[0].id),
      ),
    );
    assert.equal(reasons.filter((r) => r.status === "fulfilled").length, 2);
    await assert.rejects(
      reserve(
        db,
        { ...who, visitor: "different" },
        100,
        10000,
        "reason",
        good[1].id,
      ),
    );
  } finally {
    await mf.dispose();
  }
});
test("unreported usage holds reservation; unexpected higher usage is charged", async () => {
  const { mf, db } = await database();
  try {
    const r = await reserve(db, who, 100, 1000, "review");
    assert.equal(
      (await db
        .prepare("SELECT reserved FROM daily_budget")
        .first<{ reserved: number }>())!.reserved,
      100,
    );
    await assert.rejects(settle(db, r, 150), /exceeded/);
    assert.equal(
      (await db
        .prepare("SELECT reserved FROM daily_budget")
        .first<{ reserved: number }>())!.reserved,
      150,
    );
  } finally {
    await mf.dispose();
  }
});

test("comparison reserves three-provider maximum atomically and shares review allowance", async () => {
  const { mf, db } = await database();
  try {
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        reserve(db, who, 300, 10000, i % 2 ? "review" : "compare"),
      ),
    );
    const accepted = attempts.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>> =>
        r.status === "fulfilled",
    );
    assert.equal(accepted.length, 5);
    assert.equal(
      (await db
        .prepare("SELECT reserved FROM daily_budget")
        .first<{ reserved: number }>())!.reserved,
      1500,
    );
    await settle(db, accepted[0].value, 210); // known providers 10; unknown provider keeps its 200 reservation
    assert.equal(
      (await db
        .prepare("SELECT reserved FROM daily_budget")
        .first<{ reserved: number }>())!.reserved,
      1410,
    );
  } finally {
    await mf.dispose();
  }
});
