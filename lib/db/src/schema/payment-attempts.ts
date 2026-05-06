import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  numeric,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const paymentAttemptStatusEnum = pgEnum("payment_attempt_status", [
  "REQUIRES_ACTION",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const paymentAttempts = pgTable("payment_attempts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 32 }).notNull().default("stripe"),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  chargeId: varchar("charge_id", { length: 255 }),
  status: paymentAttemptStatusEnum("status").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 8 }),
  cardBrand: varchar("card_brand", { length: 32 }),
  cardLast4: varchar("card_last4", { length: 4 }),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  cardCountry: varchar("card_country", { length: 2 }),
  cardFunding: varchar("card_funding", { length: 16 }),
  failureCode: varchar("failure_code", { length: 64 }),
  declineCode: varchar("decline_code", { length: 64 }),
  failureMessage: text("failure_message"),
  outcomeNetworkStatus: varchar("outcome_network_status", { length: 64 }),
  outcomeReason: varchar("outcome_reason", { length: 64 }),
  outcomeRiskLevel: varchar("outcome_risk_level", { length: 32 }),
  outcomeSellerMessage: text("outcome_seller_message"),
  threeDsResult: varchar("three_ds_result", { length: 64 }),
  threeDsAuthenticationFlow: varchar("three_ds_authentication_flow", { length: 32 }),
  threeDsVersion: varchar("three_ds_version", { length: 16 }),
  eventType: varchar("event_type", { length: 64 }),
  rawEventId: varchar("raw_event_id", { length: 255 }).unique(),
  rawPayload: jsonb("raw_payload"),
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  orderIdIdx: index("payment_attempts_order_id_idx").on(t.orderId),
  paymentIntentIdx: index("payment_attempts_payment_intent_id_idx").on(t.paymentIntentId),
  statusIdx: index("payment_attempts_status_idx").on(t.status),
  occurredAtIdx: index("payment_attempts_occurred_at_idx").on(t.occurredAt),
}));

export type PaymentAttempt = typeof paymentAttempts.$inferSelect;
export type InsertPaymentAttempt = typeof paymentAttempts.$inferInsert;
