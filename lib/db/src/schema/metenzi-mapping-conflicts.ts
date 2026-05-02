import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { products } from "./products";
import { metenziProductMappings } from "./metenzi-mappings";
import { users } from "./users";

/**
 * Conflicts surfaced by the Metenzi product sync that need human judgement
 * instead of an automatic write. Examples:
 *   - uuid_rotation:    a Metenzi SKU we already track shows up under a new
 *                       Metenzi UUID (could be a legitimate rotation, could be
 *                       two distinct products that share a SKU). Auto-migrating
 *                       could mismap real orders, so we ask the admin.
 *   - fuzzy_name_match: a brand-new Metenzi UUID arrives whose name closely
 *                       resembles an existing pixel product. Could be a renamed
 *                       Metenzi product whose UUID/SKU also rotated, could be
 *                       a genuinely new SKU. Admin decides.
 *   - sku_collision:    two different Metenzi UUIDs with the same SKU were seen
 *                       in the same sync run — both can't be authoritative.
 */
export const metenziMappingConflicts = pgTable("metenzi_mapping_conflicts", {
  id: serial("id").primaryKey(),
  conflictType: varchar("conflict_type", { length: 50 }).notNull(),
  metenziProductId: varchar("metenzi_product_id", { length: 100 }).notNull(),
  metenziSku: varchar("metenzi_sku", { length: 100 }),
  metenziName: varchar("metenzi_name", { length: 300 }),
  rawPayload: jsonb("raw_payload").notNull(),
  // The pixel product the sync thinks is the right counterpart. Admin can
  // confirm (link), override (link to a different one), reject (create new),
  // or dismiss (do nothing).
  candidatePixelProductId: integer("candidate_pixel_product_id").references(() => products.id, { onDelete: "set null" }),
  candidateMappingId: integer("candidate_mapping_id").references(() => metenziProductMappings.id, { onDelete: "set null" }),
  similarityScore: numeric("similarity_score", { precision: 5, scale: 2 }),
  // Lifecycle: pending → resolved_link | resolved_create | dismissed
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  resolutionNote: text("resolution_note"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("metenzi_mapping_conflicts_status_idx").on(t.status),
  metenziIdIdx: index("metenzi_mapping_conflicts_metenzi_id_idx").on(t.metenziProductId),
}));

export type MetenziMappingConflict = typeof metenziMappingConflicts.$inferSelect;
export type InsertMetenziMappingConflict = typeof metenziMappingConflicts.$inferInsert;
