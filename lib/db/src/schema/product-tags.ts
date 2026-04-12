import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    colorHex: varchar("color_hex", { length: 7 }).default("#3b82f6"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("tags_sort_idx").on(t.sortOrder, t.id),
  ],
);

export const productTags = pgTable(
  "product_tags",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_tags_uidx").on(t.productId, t.tagId),
    index("product_tags_tag_idx").on(t.tagId),
    index("product_tags_product_idx").on(t.productId),
  ],
);

export type Tag = typeof tags.$inferSelect;
export type ProductTagRow = typeof productTags.$inferSelect;
