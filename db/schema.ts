import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
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
