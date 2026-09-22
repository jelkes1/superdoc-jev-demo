import { PublicError } from "./validation";
export interface Reservation {
  id: string;
  day: string;
  amount: number;
}
export interface Identity {
  visitor: string;
  ip: string;
  cookie: string | null;
}
export async function digest(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function identity(
  request: Request,
  salt: string,
): Promise<Identity> {
  const raw = request.headers
    .get("cookie")
    ?.match(/(?:^|; )jev-visitor=([a-f0-9-]{36})(?:;|$)/)?.[1];
  const visitor = raw ?? crypto.randomUUID();
  const ip = request.headers.get("cf-connecting-ip") ?? "local-preview";
  const day = new Date().toISOString().slice(0, 10);
  return {
    visitor: await digest(`${salt}:${visitor}`),
    ip: await digest(`${salt}:${day}:${ip}`),
    cookie: raw
      ? null
      : `jev-visitor=${visitor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`,
  };
}
export async function reserve(
  db: D1Database,
  id: Identity,
  amount: number,
  limit: number,
  kind: "review" | "reason" | "compare",
  parent?: string,
): Promise<Reservation> {
  if (!db)
    throw new PublicError(
      "Usage controls are unavailable. Please try later.",
      503,
    );
  const now = Date.now(),
    day = new Date(now).toISOString().slice(0, 10),
    hour = Math.floor(now / 3600000);
  const requestId = crypto.randomUUID();
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > limit)
    throw new PublicError(
      "This request exceeds the available demo allowance.",
      429,
    );
  const keys = [`v:${hour}:${id.visitor}`, `i:${hour}:${id.ip}`];
  const permission =
    kind !== "reason"
      ? `(SELECT count FROM rate_limits WHERE key=?) < 5 AND (SELECT count FROM rate_limits WHERE key=?) < 5`
      : `EXISTS(SELECT 1 FROM reservations WHERE id=? AND visitor=? AND ip=? AND kind='review' AND settled=1 AND created>?) AND (SELECT COUNT(*) FROM reservations WHERE parent=?) < 2`;
  const args =
    kind !== "reason"
      ? keys
      : [parent ?? "", id.visitor, id.ip, now - 3600000, parent ?? ""];
  const statements = [
    db
      .prepare("INSERT OR IGNORE INTO daily_budget(day,reserved) VALUES(?,0)")
      .bind(day),
    ...keys.map((k) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO rate_limits(key,count,expires) VALUES(?,0,?)",
        )
        .bind(k, now + 3600000),
    ),
    db
      .prepare(
        `INSERT INTO reservations(id,day,visitor,ip,kind,parent,amount,created) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT reserved FROM daily_budget WHERE day=?) + ? <= ? AND ${permission}`,
      )
      .bind(
        requestId,
        day,
        id.visitor,
        id.ip,
        kind,
        parent ?? null,
        amount,
        now,
        day,
        amount,
        limit,
        ...args,
      ),
    db
      .prepare(
        "UPDATE daily_budget SET reserved=reserved+? WHERE day=? AND EXISTS(SELECT 1 FROM reservations WHERE id=?)",
      )
      .bind(amount, day, requestId),
  ];
  if (kind !== "reason")
    for (const key of keys)
      statements.push(
        db
          .prepare(
            "UPDATE rate_limits SET count=count+1 WHERE key=? AND EXISTS(SELECT 1 FROM reservations WHERE id=?)",
          )
          .bind(key, requestId),
      );
  // D1 batch is transactional: both visitor limits and the global budget are checked and incremented together.
  const result = await db.batch(statements);
  if (result[3].meta.changes !== 1)
    throw new PublicError(
      kind !== "reason"
        ? "Demo allowance reached. Try again later or run the example locally with your own keys."
        : "This review’s reasoning allowance is exhausted or expired.",
      429,
    );
  return { id: requestId, day, amount };
}
export async function settle(db: D1Database, r: Reservation, actual: number) {
  if (!Number.isFinite(actual) || actual < 0) throw new Error("Invalid usage");
  const charge = Math.ceil(actual);
  // A duplicate settle cannot release the same reservation twice.
  await db.batch([
    db
      .prepare(
        "UPDATE daily_budget SET reserved=reserved-? WHERE day=? AND EXISTS(SELECT 1 FROM reservations WHERE id=? AND settled=0)",
      )
      .bind(r.amount - charge, r.day, r.id),
    db
      .prepare(
        "UPDATE reservations SET amount=?,settled=1 WHERE id=? AND settled=0",
      )
      .bind(charge, r.id),
  ]);
  if (charge > r.amount)
    throw new Error("Provider usage exceeded the configured reservation bound");
}
export async function prune(db: D1Database) {
  const before = Date.now() - 7 * 86400000;
  await db.batch([
    db.prepare("DELETE FROM reservations WHERE created<?").bind(before),
    db.prepare("DELETE FROM rate_limits WHERE expires<?").bind(Date.now()),
    db
      .prepare("DELETE FROM daily_budget WHERE day<?")
      .bind(new Date(before).toISOString().slice(0, 10)),
  ]);
}
