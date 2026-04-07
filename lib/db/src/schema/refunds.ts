import { pgTable, serial, integer, varchar, text, numeric, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { users } from "./users";

export const refundStatusEnum = pgEnum("refund_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

export const refunds = pgTable("refunds", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  initiatedBy: integer("initiated_by").notNull().references(() => users.id),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 100 }).notNull(),
  notes: text("notes"),
  status: refundStatusEnum("status").notNull().default("PENDING"),
  externalRefundId: varchar("external_refund_id", { length: 255 }),
  failureReason: text("failure_reason"),
  notifyCustomer: boolean("notify_customer").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

export type Refund = typeof refunds.$inferSelect;
