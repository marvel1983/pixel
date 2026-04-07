import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { orderItems } from "./orders";
import { productVariants } from "./products";

export const keyStatusEnum = pgEnum("key_status", [
  "AVAILABLE",
  "SOLD",
  "RESERVED",
  "REVOKED",
]);

export const keySourceEnum = pgEnum("key_source", [
  "MANUAL",
  "API",
  "BULK_IMPORT",
]);

export const licenseKeys = pgTable("license_keys", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id")
    .notNull()
    .references(() => productVariants.id),
  keyValue: text("key_value").notNull(),
  status: keyStatusEnum("status").notNull().default("AVAILABLE"),
  source: keySourceEnum("source").notNull().default("MANUAL"),
  orderItemId: integer("order_item_id").references(() => orderItems.id),
  soldAt: timestamp("sold_at"),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLicenseKeySchema = createInsertSchema(licenseKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertLicenseKey = z.infer<typeof insertLicenseKeySchema>;
export type LicenseKey = typeof licenseKeys.$inferSelect;
