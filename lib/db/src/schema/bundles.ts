import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { products } from "./products";

export const bundleDiscountTypeEnum = pgEnum("bundle_discount_type", [
  "PERCENTAGE",
  "FIXED",
  "BUY_X_GET_Y_FREE",
]);

export const bundles = pgTable("bundles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  description: text("description"),
  shortDescription: varchar("short_description", { length: 500 }),
  imageUrl: text("image_url"),
  bundlePriceUsd: numeric("bundle_price_usd", { precision: 10, scale: 2 }).notNull(),
  primaryProductId: integer("primary_product_id").references(() => products.id, { onDelete: "set null" }),
  discountType: bundleDiscountTypeEnum("discount_type").notNull().default("FIXED"),
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
  minPrimaryQty: integer("min_primary_qty").notNull().default(1),
  useAnchorPrice: boolean("use_anchor_price").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  metaTitle: varchar("meta_title", { length: 300 }),
  metaDescription: varchar("meta_description", { length: 500 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bundleItems = pgTable("bundle_items", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id")
    .notNull()
    .references(() => bundles.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  isFree: boolean("is_free").notNull().default(false),
});

export const insertBundleSchema = createInsertSchema(bundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({
  id: true,
});

export type Bundle = typeof bundles.$inferSelect;
export type InsertBundle = z.infer<typeof insertBundleSchema>;
export type BundleItem = typeof bundleItems.$inferSelect;
