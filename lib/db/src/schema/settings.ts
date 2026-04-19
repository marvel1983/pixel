import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface RiskScoringConfig {
  enabled: boolean;
  holdThreshold: number;
  minOrderHoldAmount: number; // 0 = disabled; any order >= this value is auto-held
  newAccountHighValueScore: number;
  newAccountHighValueMin: number;
  newAccountBaseScore: number;
  firstOrderScore: number;
  bulkQtyHighScore: number;
  bulkQtyHighMin: number;
  bulkQtyLowScore: number;
  bulkQtyLowMin: number;
  geoMismatchScore: number;
  guestHighValueScore: number;
  guestHighValueMin: number;
  highOrderValueScore: number;
  highOrderValueMin: number;
}

export const DEFAULT_RISK_CONFIG: RiskScoringConfig = {
  enabled: true,
  holdThreshold: 60,
  minOrderHoldAmount: 0,
  newAccountHighValueScore: 40,
  newAccountHighValueMin: 50,
  newAccountBaseScore: 15,
  firstOrderScore: 10,
  bulkQtyHighScore: 35,
  bulkQtyHighMin: 5,
  bulkQtyLowScore: 15,
  bulkQtyLowMin: 3,
  geoMismatchScore: 30,
  guestHighValueScore: 20,
  guestHighValueMin: 80,
  highOrderValueScore: 20,
  highOrderValueMin: 200,
};

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  siteName: varchar("site_name", { length: 200 }).notNull().default("PixelCodes"),
  siteDescription: text("site_description"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  contactEmail: varchar("contact_email", { length: 255 }),
  supportEmail: varchar("support_email", { length: 255 }),
  fromEmail: varchar("from_email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  companyName: varchar("company_name", { length: 200 }),
  companyAddress: varchar("company_address", { length: 300 }),
  companyCity: varchar("company_city", { length: 120 }),
  companyCountry: varchar("company_country", { length: 100 }),
  companyZip: varchar("company_zip", { length: 20 }),
  companyTaxId: varchar("company_tax_id", { length: 100 }),
  tagline: text("tagline"),
  copyright: text("copyright"),
  socialLinks: jsonb("social_links")
    .$type<Record<string, string>>()
    .default({}),
  announcementBar: text("announcement_bar"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  defaultCurrency: varchar("default_currency", { length: 3 })
    .notNull()
    .default("EUR"),
  enabledCurrencies: jsonb("enabled_currencies")
    .$type<string[]>()
    .default(["EUR", "USD", "GBP"]),
  cppEnabled: boolean("cpp_enabled").notNull().default(false),
  cppLabel: varchar("cpp_label", { length: 200 }).default("Checkout Protection Plan"),
  cppPrice: numeric("cpp_price", { precision: 10, scale: 2 }).default("0.99"),
  cppDescription: text("cpp_description").default("Protect your purchase with instant replacement if your key doesn't work."),
  processingFeePercent: numeric("processing_fee_percent", { precision: 5, scale: 2 }).default("0"),
  processingFeeFixed: numeric("processing_fee_fixed", { precision: 10, scale: 2 }).default("0"),
  trustpilotUrl: text("trustpilot_url"),
  trustpilotEnabled: boolean("trustpilot_enabled").notNull().default(false),
  trustpilotBusinessUnitId: varchar("trustpilot_business_unit_id", { length: 255 }),
  trustpilotApiKeyEncrypted: text("trustpilot_api_key_encrypted"),
  trustpilotInviteDelayDays: integer("trustpilot_invite_delay_days").notNull().default(3),
  trustpilotCachedRating: numeric("trustpilot_cached_rating", { precision: 3, scale: 1 }).default("4.7"),
  trustpilotCachedCount: integer("trustpilot_cached_count").default(2847),
  metaTitleTemplate: varchar("meta_title_template", { length: 300 }),
  metaDescription: text("meta_description"),
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: text("smtp_pass"),
  smtpFrom: varchar("smtp_from", { length: 255 }),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  liveChatEnabled: boolean("live_chat_enabled").notNull().default(false),
  liveChatCode: text("live_chat_code"),
  googleOAuthEnabled: boolean("google_oauth_enabled").notNull().default(false),
  googleClientId: varchar("google_client_id", { length: 500 }),
  googleClientSecret: text("google_client_secret"),
  spViewersEnabled: boolean("sp_viewers_enabled").notNull().default(true),
  spViewersMin: integer("sp_viewers_min").notNull().default(3),
  spSoldEnabled: boolean("sp_sold_enabled").notNull().default(true),
  spSoldMin: integer("sp_sold_min").notNull().default(5),
  spToastEnabled: boolean("sp_toast_enabled").notNull().default(true),
  spToastIntervalMin: integer("sp_toast_interval_min").notNull().default(45),
  spToastIntervalMax: integer("sp_toast_interval_max").notNull().default(90),
  spToastMaxPerSession: integer("sp_toast_max_per_session").notNull().default(3),
  spStockUrgencyEnabled: boolean("sp_stock_urgency_enabled").notNull().default(true),
  spStockLowThreshold: integer("sp_stock_low_threshold").notNull().default(10),
  spStockCriticalThreshold: integer("sp_stock_critical_threshold").notNull().default(3),
  turnstileEnabled: boolean("turnstile_enabled").notNull().default(false),
  turnstileSiteKey: varchar("turnstile_site_key", { length: 500 }),
  turnstileSecretKey: text("turnstile_secret_key"),
  riskConfig: jsonb("risk_config").$type<RiskScoringConfig>(),
  processingFeeTiers: jsonb("processing_fee_tiers").$type<Array<{ minAmount: number; feePercent: number; feeFixed: number }>>(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 300 }).notNull().unique(),
  content: text("content"),
  metaTitle: varchar("meta_title", { length: 120 }),
  metaDescription: varchar("meta_description", { length: 320 }),
  isPublished: boolean("is_published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  categoryLabel: varchar("category_label", { length: 100 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSiteSettingsSchema = createInsertSchema(siteSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertPageSchema = createInsertSchema(pages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFaqSchema = createInsertSchema(faqs).omit({
  id: true,
  createdAt: true,
});

export type InsertSiteSettings = z.infer<typeof insertSiteSettingsSchema>;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pages.$inferSelect;
export type InsertFaq = z.infer<typeof insertFaqSchema>;
export type Faq = typeof faqs.$inferSelect;
