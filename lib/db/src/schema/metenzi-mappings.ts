import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const metenziProductMappings = pgTable("metenzi_product_mappings", {
  id: serial("id").primaryKey(),
  metenziProductId: varchar("metenzi_product_id", { length: 100 }).notNull().unique(),
  metenziSku: varchar("metenzi_sku", { length: 100 }),
  metenziName: varchar("metenzi_name", { length: 300 }),
  pixelProductId: integer("pixel_product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  autoSyncStock: boolean("auto_sync_stock").notNull().default(false),
  lastStockSyncAt: timestamp("last_stock_sync_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MetenziProductMapping = typeof metenziProductMappings.$inferSelect;
export type InsertMetenziProductMapping = typeof metenziProductMappings.$inferInsert;
