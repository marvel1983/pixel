import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { products } from "./products";

// A single Metenzi product can map to many Pixel products (e.g. the same key
// pool sold under multiple branded variants). Uniqueness is on the *pair*
// (metenzi_product_id, pixel_product_id) — not on metenzi_product_id alone.
export const metenziProductMappings = pgTable("metenzi_product_mappings", {
  id: serial("id").primaryKey(),
  metenziProductId: varchar("metenzi_product_id", { length: 100 }).notNull(),
  metenziSku: varchar("metenzi_sku", { length: 100 }),
  metenziName: varchar("metenzi_name", { length: 300 }),
  pixelProductId: integer("pixel_product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  autoSyncStock: boolean("auto_sync_stock").notNull().default(false),
  // When true, sync ignores this mapping entirely. Set by the admin "Unmap"
  // action so manual decisions survive across sync runs (instead of having
  // sync silently re-create the link).
  disabled: boolean("disabled").notNull().default(false),
  lastStockSyncAt: timestamp("last_stock_sync_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  metenziPixelPairUnique: uniqueIndex("metenzi_product_mappings_pair_uq").on(t.metenziProductId, t.pixelProductId),
}));

export type MetenziProductMapping = typeof metenziProductMappings.$inferSelect;
export type InsertMetenziProductMapping = typeof metenziProductMappings.$inferInsert;
