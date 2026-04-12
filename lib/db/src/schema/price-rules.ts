import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { productVariants } from "./products";

// ── Enum ─────────────────────────────────────────────────────────────────────

export const priceRuleTypeEnum = pgEnum("price_rule_type", [
  "PERCENTAGE_OFF", // value = discount % (0–100), applied to effectivePrice
  "FIXED_PRICE",    // value = absolute sell price in USD
]);

// ── price_rules ───────────────────────────────────────────────────────────────
// Time-boxed pricing rules applied by the engine after flash sale and
// priceOverrideUsd checks. Lower priority number = evaluated first.
//
// Scope: if scopeVariantIds is non-empty, rule only applies to those variants.
//        if scopeCategoryIds is non-empty, rule applies to all variants whose
//        product belongs to those categories.
//        if both are null/empty, rule applies to ALL variants (store-wide).
//
// The engine picks the single highest-priority matching rule (no stacking).

export const priceRules = pgTable(
  "price_rules",
  {
    id:               serial("id").primaryKey(),
    name:             varchar("name", { length: 200 }).notNull(),
    ruleType:         priceRuleTypeEnum("rule_type").notNull(),
    /** Percent (0–100) for PERCENTAGE_OFF; USD amount for FIXED_PRICE */
    value:            numeric("value", { precision: 10, scale: 2 }).notNull(),
    /** Lower number = higher priority. Ties broken by id ASC. */
    priority:         integer("priority").notNull().default(100),
    isActive:         boolean("is_active").notNull().default(true),
    validFrom:        timestamp("valid_from"),
    validTo:          timestamp("valid_to"),
    /** int[] — null/empty means "all variants" */
    scopeVariantIds:  jsonb("scope_variant_ids").$type<number[]>(),
    /** int[] — null/empty means "all categories" */
    scopeCategoryIds: jsonb("scope_category_ids").$type<number[]>(),
    createdBy:        integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt:        timestamp("created_at").notNull().defaultNow(),
    updatedAt:        timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Engine fetches active rules sorted by priority — this covers the WHERE + ORDER BY
    index("price_rules_priority_active_idx").on(table.priority, table.isActive),
    // Validity window filter used on every rule lookup
    index("price_rules_valid_range_idx").on(table.validFrom, table.validTo),
  ],
);

// ── price_change_log ─────────────────────────────────────────────────────────
// Append-only audit trail of every effective price change per variant.
// Written by the admin when creating/updating rules, flash sales, or manual
// overrides. Never written by the order pipeline (that uses audit_log).

export const priceChangeLog = pgTable("price_change_log", {
  id:          serial("id").primaryKey(),
  variantId:   integer("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  /** Which layer caused the change */
  source:      varchar("source", { length: 50 }).notNull(), // 'PRICE_RULE' | 'FLASH_SALE' | 'MANUAL_OVERRIDE' | 'BASE_PRICE'
  /** FK to price_rules.id or flash_sales.id etc., nullable */
  sourceId:    integer("source_id"),
  oldValueUsd: numeric("old_value_usd", { precision: 10, scale: 2 }).notNull(),
  newValueUsd: numeric("new_value_usd", { precision: 10, scale: 2 }).notNull(),
  changedBy:   integer("changed_by").references(() => users.id, { onDelete: "set null" }),
  changedAt:   timestamp("changed_at").notNull().defaultNow(),
  note:        text("note"),
});

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const insertPriceRuleSchema = createInsertSchema(priceRules, {
  name:    (s) => s.min(1).max(200),
  value:   (s) => s.regex(/^\d+(\.\d{1,2})?$/, "Must be a valid decimal"),
  priority: (s) => s.gte(1).lte(9999),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updatePriceRuleSchema = insertPriceRuleSchema.partial();

// ── Types ─────────────────────────────────────────────────────────────────────

export type PriceRule       = typeof priceRules.$inferSelect;
export type InsertPriceRule = z.infer<typeof insertPriceRuleSchema>;
export type UpdatePriceRule = z.infer<typeof updatePriceRuleSchema>;
export type PriceChangeLog  = typeof priceChangeLog.$inferSelect;
