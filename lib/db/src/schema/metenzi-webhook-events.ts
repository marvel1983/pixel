import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";

/**
 * Persistent log of every Metenzi webhook event we receive. Stored before any
 * processing so a failed handler still leaves a forensic record. Used by the
 * admin UI for debugging stuck/silent fulfillments without grepping pm2 logs.
 */
export const metenziWebhookEvents = pgTable("metenzi_webhook_events", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  metenziOrderId: varchar("metenzi_order_id", { length: 100 }),
  // Foreign-keyed loosely (set null on delete) so logs survive order purge.
  relatedOrderId: integer("related_order_id").references(() => orders.id, {
    onDelete: "set null",
  }),
  rawPayload: jsonb("raw_payload").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
  success: boolean("success"),
  errorMsg: text("error_msg"),
  // Lightweight string summarising what the handler did, e.g. "delivered:3"
  outcomeNote: varchar("outcome_note", { length: 200 }),
}, (t) => ({
  receivedAtIdx: index("metenzi_webhook_events_received_at_idx").on(t.receivedAt),
  metenziOrderIdIdx: index("metenzi_webhook_events_metenzi_order_id_idx").on(t.metenziOrderId),
  relatedOrderIdIdx: index("metenzi_webhook_events_related_order_id_idx").on(t.relatedOrderId),
}));

export type MetenziWebhookEvent = typeof metenziWebhookEvents.$inferSelect;
export type InsertMetenziWebhookEvent = typeof metenziWebhookEvents.$inferInsert;
