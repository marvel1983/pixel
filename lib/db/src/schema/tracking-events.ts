import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const TRACKING_EVENT_TYPES = [
  "page_view",
  "product_view",
  "add_to_cart",
  "remove_from_cart",
  "update_cart_qty",
  "apply_coupon",
  "enter_checkout",
  "checkout_step",
  "form_field_focus",
  "form_field_blur",
  "form_validation_error",
  "payment_method_selected",
  "place_order_clicked",
  "stripe_redirect",
  "stripe_error",
  "order_created",
  "order_failed",
  "page_unload",
  "js_error",
  "custom_click",
] as const;

export type TrackingEventType = (typeof TRACKING_EVENT_TYPES)[number];

export const trackingEvents = pgTable("tracking_events", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 36 }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  pagePath: text("page_path"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
}, (t) => ({
  sessionTimeIdx: index("tracking_events_session_time_idx").on(t.sessionId, t.occurredAt),
  typeTimeIdx: index("tracking_events_type_time_idx").on(t.eventType, t.occurredAt),
  userTimeIdx: index("tracking_events_user_time_idx").on(t.userId, t.occurredAt),
}));

export const insertTrackingEventSchema = createInsertSchema(trackingEvents).omit({
  id: true,
  receivedAt: true,
});

export type InsertTrackingEvent = z.infer<typeof insertTrackingEventSchema>;
export type TrackingEvent = typeof trackingEvents.$inferSelect;
