import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const quoteStatusEnum = pgEnum("quote_status", [
  "NEW",
  "QUOTED",
  "ACCEPTED",
  "DECLINED",
]);

export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  products: jsonb("products").notNull().default([]),
  message: text("message"),
  status: quoteStatusEnum("status").notNull().default("NEW"),
  adminNotes: text("admin_notes"),
  customPricing: jsonb("custom_pricing"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bulkPricingTiers = pgTable("bulk_pricing_tiers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),
  minQty: integer("min_qty").notNull(),
  maxQty: integer("max_qty"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type BulkPricingTier = typeof bulkPricingTiers.$inferSelect;
