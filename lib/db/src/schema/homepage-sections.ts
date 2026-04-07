import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const sectionTypeEnum = pgEnum("section_type", [
  "HERO_SLIDER",
  "CATEGORY_ROW",
  "BRAND_SECTIONS",
  "NEW_ADDITIONS",
  "PRODUCT_SPOTLIGHT",
  "FEATURED_TEXT_BANNER",
]);

export const homepageSections = pgTable("homepage_sections", {
  id: serial("id").primaryKey(),
  type: sectionTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const brandSections = pgTable("brand_sections", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  bannerImage: text("banner_image"),
  bgColor: varchar("bg_color", { length: 50 }).notNull().default("bg-blue-600"),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  marketingPoints: jsonb("marketing_points").$type<string[]>().default([]),
  productIds: jsonb("product_ids").$type<number[]>().default([]),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type HomepageSection = typeof homepageSections.$inferSelect;
export type BrandSection = typeof brandSections.$inferSelect;
