import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import type { CartSnapshotItem } from "./abandoned-carts";

export interface CartSnapshotTotals {
  subtotalUsd: string;
  discountUsd: string;
  taxUsd: string;
  totalUsd: string;
  currency: string;
  couponCode?: string;
}

export const cartStateSnapshots = pgTable("cart_state_snapshots", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  triggerEvent: varchar("trigger_event", { length: 50 }).notNull(),
  items: jsonb("items").$type<CartSnapshotItem[]>().notNull(),
  totals: jsonb("totals").$type<CartSnapshotTotals>().notNull(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
}, (t) => ({
  sessionTimeIdx: index("cart_snapshots_session_time_idx").on(t.sessionId, t.capturedAt),
}));

export const insertCartStateSnapshotSchema = createInsertSchema(cartStateSnapshots).omit({
  id: true,
  capturedAt: true,
});

export type InsertCartStateSnapshot = z.infer<typeof insertCartStateSnapshotSchema>;
export type CartStateSnapshot = typeof cartStateSnapshots.$inferSelect;
