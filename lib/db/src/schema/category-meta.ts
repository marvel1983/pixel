import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categories } from "./categories";

export const categoryMeta = pgTable("category_meta", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" })
    .unique(),
  displayName: varchar("display_name", { length: 200 }),
  showInNav: boolean("show_in_nav").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  heroImageUrl: text("hero_image_url"),
  bannerText: text("banner_text"),
  seoKeywords: varchar("seo_keywords", { length: 500 }),
  customFields: jsonb("custom_fields")
    .$type<Record<string, string>>()
    .default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCategoryMetaSchema = createInsertSchema(categoryMeta).omit({
  id: true,
  updatedAt: true,
});

export type InsertCategoryMeta = z.infer<typeof insertCategoryMetaSchema>;
export type CategoryMeta = typeof categoryMeta.$inferSelect;
