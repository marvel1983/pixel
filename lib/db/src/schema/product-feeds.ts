import { pgTable, serial, varchar, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export interface FieldMapping {
  id: string;
  feedKey: string;
  sourceType: "attribute" | "static";
  sourceValue: string;
  prefix: string;
  suffix: string;
}

export interface FilterRule {
  id: string;
  type: "rule";
  field: string;
  operator: "equals" | "not_equals" | "contains" | "is_greater_than" | "is_less_than" | "is_not_empty" | "regex_match";
  value: string | number;
}

export interface FilterGroup {
  id: string;
  type: "group";
  condition: "AND" | "OR";
  rules: (FilterRule | FilterGroup)[];
}

export interface CurrencyConfig {
  baseCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  taxOffset: number;
  rateMode: "manual" | "api";
}

export const productFeeds = pgTable("product_feeds", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull().unique(),
  accessToken: varchar("access_token", { length: 64 }).notNull(),
  channelType: varchar("channel_type", { length: 50 }).notNull().default("google_shopping"),
  format: varchar("format", { length: 10 }).notNull().default("xml"),
  // inactive | active | generating | error
  status: varchar("status", { length: 20 }).notNull().default("inactive"),
  targetCountry: varchar("target_country", { length: 10 }).default("US"),
  targetLocale: varchar("target_locale", { length: 10 }).default("en"),
  // hourly | daily | manual
  refreshInterval: varchar("refresh_interval", { length: 20 }).notNull().default("daily"),
  includeVariations: boolean("include_variations").notNull().default(false),
  fieldMappings: jsonb("field_mappings").$type<FieldMapping[]>().default([]),
  filterRules: jsonb("filter_rules").$type<FilterGroup>().default({ id: "root", type: "group", condition: "AND", rules: [] }),
  currencyConfig: jsonb("currency_config").$type<CurrencyConfig>().default({
    baseCurrency: "USD", targetCurrency: "USD", exchangeRate: 1, taxOffset: 0, rateMode: "manual",
  }),
  storeUrl: varchar("store_url", { length: 500 }).default(""),
  outputPath: text("output_path"),
  lastGeneratedAt: timestamp("last_generated_at"),
  lastError: text("last_error"),
  lastRowCount: integer("last_row_count"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ProductFeed = typeof productFeeds.$inferSelect;
export type InsertProductFeed = typeof productFeeds.$inferInsert;
