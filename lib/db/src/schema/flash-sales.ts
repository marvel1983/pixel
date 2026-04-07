import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { productVariants } from "./products";

export const flashSaleStatusEnum = pgEnum("flash_sale_status", [
  "DRAFT",
  "ACTIVE",
  "ENDED",
]);

export const flashSales = pgTable("flash_sales", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  description: text("description"),
  status: flashSaleStatusEnum("status").notNull().default("DRAFT"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  bannerText: varchar("banner_text", { length: 300 }),
  bannerColor: varchar("banner_color", { length: 20 }).default("#ef4444"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const flashSaleProducts = pgTable("flash_sale_products", {
  id: serial("id").primaryKey(),
  flashSaleId: integer("flash_sale_id")
    .notNull()
    .references(() => flashSales.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  variantId: integer("variant_id")
    .notNull()
    .references(() => productVariants.id, { onDelete: "cascade" }),
  salePriceUsd: numeric("sale_price_usd", { precision: 10, scale: 2 }).notNull(),
  maxQuantity: integer("max_quantity").notNull().default(100),
  soldCount: integer("sold_count").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type FlashSale = typeof flashSales.$inferSelect;
export type FlashSaleProduct = typeof flashSaleProducts.$inferSelect;
