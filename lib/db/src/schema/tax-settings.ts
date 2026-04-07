import { pgTable, serial, varchar, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const taxSettings = pgTable("tax_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  priceDisplay: varchar("price_display", { length: 20 }).notNull().default("exclusive"),
  taxLabel: varchar("tax_label", { length: 100 }).notNull().default("VAT"),
  defaultRate: numeric("default_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  merchantVatNumber: varchar("merchant_vat_number", { length: 50 }),
  b2bExemptionEnabled: boolean("b2b_exemption_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const taxRates = pgTable("tax_rates", {
  id: serial("id").primaryKey(),
  countryCode: varchar("country_code", { length: 2 }).notNull().unique(),
  countryName: varchar("country_name", { length: 100 }).notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
