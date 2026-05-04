import { pgTable, serial, varchar, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  headline: varchar("headline", { length: 300 }).notNull(),
  subtext: text("subtext"),
  heroImageUrl: text("hero_image_url"),
  heroBgColor: varchar("hero_bg_color", { length: 20 }).default("#0f172a"),
  endsAt: timestamp("ends_at"),
  couponCode: varchar("coupon_code", { length: 50 }),
  productIds: jsonb("product_ids").$type<number[]>().default([]),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
