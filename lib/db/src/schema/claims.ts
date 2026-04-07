import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { licenseKeys } from "./license-keys";
import { orders } from "./orders";

export const claimStatusEnum = pgEnum("claim_status", [
  "OPEN",
  "IN_REVIEW",
  "APPROVED",
  "DENIED",
  "RESOLVED",
]);

export const claimReasonEnum = pgEnum("claim_reason", [
  "DEFECTIVE",
  "ALREADY_USED",
  "WRONG_PRODUCT",
  "NOT_RECEIVED",
  "OTHER",
]);

export const claims = pgTable("claims", {
  id: serial("id").primaryKey(),
  licenseKeyId: integer("license_key_id").references(() => licenseKeys.id),
  orderId: integer("order_id").references(() => orders.id),
  metenziClaimId: varchar("metenzi_claim_id", { length: 100 }),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  reason: claimReasonEnum("reason").notNull(),
  status: claimStatusEnum("status").notNull().default("OPEN"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Claim = typeof claims.$inferSelect;
