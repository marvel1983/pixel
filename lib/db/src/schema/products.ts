import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categories } from "./categories";

export const productTypeEnum = pgEnum("product_type", [
  "SOFTWARE",
  "GAME",
  "SUBSCRIPTION",
  "DLC",
  "GIFT_CARD",
]);

export const platformEnum = pgEnum("platform", [
  "WINDOWS",
  "MAC",
  "LINUX",
  "STEAM",
  "ORIGIN",
  "UPLAY",
  "GOG",
  "EPIC",
  "XBOX",
  "PLAYSTATION",
  "NINTENDO",
  "OTHER",
]);

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  shortDescription: varchar("short_description", { length: 500 }),
  description: text("description"),
  type: productTypeEnum("type").notNull().default("SOFTWARE"),
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: text("image_url"),
  galleryImages: jsonb("gallery_images").$type<string[]>().default([]),
  metaTitle: varchar("meta_title", { length: 300 }),
  metaDescription: varchar("meta_description", { length: 500 }),
  isFeatured: boolean("is_featured").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  avgRating: numeric("avg_rating", { precision: 3, scale: 2 }).default("0"),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  platform: platformEnum("platform"),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  compareAtPriceUsd: numeric("compare_at_price_usd", {
    precision: 10,
    scale: 2,
  }),
  stockCount: integer("stock_count").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductVariantSchema = createInsertSchema(
  productVariants,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;
