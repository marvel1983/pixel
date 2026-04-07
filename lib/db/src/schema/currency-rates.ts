import {
  pgTable,
  serial,
  varchar,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const currencyRates = pgTable("currency_rates", {
  id: serial("id").primaryKey(),
  currencyCode: varchar("currency_code", { length: 3 }).notNull().unique(),
  rateToUsd: numeric("rate_to_usd", { precision: 12, scale: 6 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCurrencyRateSchema = createInsertSchema(currencyRates).omit({
  id: true,
  updatedAt: true,
});

export type InsertCurrencyRate = z.infer<typeof insertCurrencyRateSchema>;
export type CurrencyRate = typeof currencyRates.$inferSelect;
