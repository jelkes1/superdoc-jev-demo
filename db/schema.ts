import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const budget = sqliteTable("daily_budget", {
  day: text("day").primaryKey(),
  reserved: integer("reserved").notNull().default(0),
});
export const rates = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  expires: integer("expires").notNull(),
});
export const reservations = sqliteTable("reservations", {
  id: text("id").primaryKey(),
  day: text("day").notNull(),
  visitor: text("visitor").notNull(),
  ip: text("ip").notNull(),
  kind: text("kind").notNull(),
  parent: text("parent"),
  amount: integer("amount").notNull(),
  settled: integer("settled").notNull().default(0),
  created: integer("created").notNull(),
});
export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    snapshot: text("snapshot").notNull(),
    expires: integer("expires").notNull(),
    closed: integer("closed").notNull().default(0),
  },
  (t) => [index("workflow_expiry").on(t.closed, t.expires)],
);
export const workflowSlots = sqliteTable(
  "workflow_slots",
  {
    runId: text("run_id").notNull(),
    model: text("model").notNull(),
    maximum: integer("maximum").notNull(),
    state: text("state").notNull().default("ready"),
    charged: integer("charged"),
  },
  (t) => [primaryKey({ columns: [t.runId, t.model] })],
);
