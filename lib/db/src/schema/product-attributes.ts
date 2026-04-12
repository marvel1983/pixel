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
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const attributeTypeEnum = pgEnum("attribute_type", [
  "SELECT",
  "TEXT",
  "BOOLEAN",
  "NUMBER",
]);

export const attributeDefinitions = pgTable(
  "attribute_definitions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    type: attributeTypeEnum("type").notNull().default("SELECT"),
    isFilterable: boolean("is_filterable").notNull().default(true),
    isVisibleOnPdp: boolean("is_visible_on_pdp").notNull().default(true),
    isSearchable: boolean("is_searchable").notNull().default(false),
    unit: varchar("unit", { length: 50 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("attr_def_sort_idx").on(t.sortOrder, t.id),
    index("attr_def_filterable_idx").on(t.isFilterable),
  ],
);

export const attributeOptions = pgTable(
  "attribute_options",
  {
    id: serial("id").primaryKey(),
    attributeId: integer("attribute_id")
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: "cascade" }),
    value: varchar("value", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    colorHex: varchar("color_hex", { length: 7 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attr_option_attr_slug_uidx").on(t.attributeId, t.slug),
    index("attr_option_attr_id_idx").on(t.attributeId, t.sortOrder),
  ],
);

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    attributeId: integer("attribute_id")
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: "cascade" }),
    optionId: integer("option_id")
      .references(() => attributeOptions.id, { onDelete: "set null" }),
    valueText: text("value_text"),
    valueNumber: numeric("value_number", { precision: 12, scale: 4 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("product_attr_product_attr_uidx").on(t.productId, t.attributeId),
    index("product_attr_option_idx").on(t.optionId, t.productId),
    index("product_attr_product_idx").on(t.productId),
    index("product_attr_attr_id_idx").on(t.attributeId),
  ],
);

export type AttributeDefinition = typeof attributeDefinitions.$inferSelect;
export type AttributeOption = typeof attributeOptions.$inferSelect;
export type ProductAttribute = typeof productAttributes.$inferSelect;
