import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  AnyPgColumn,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  displayName: varchar("display_name", { length: 200 }),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  showInNav: boolean("show_in_nav").notNull().default(true),
  description: text("description"),
  imageUrl: text("image_url"),
  metaTitle: varchar("meta_title", { length: 300 }),
  metaDescription: varchar("meta_description", { length: 500 }),
  parentId: integer("parent_id").references(
    (): AnyPgColumn => categories.id,
    { onDelete: "set null" },
  ),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
