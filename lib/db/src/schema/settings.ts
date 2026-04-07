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
  tagline: text("tagline"),
  copyright: text("copyright"),
  socialLinks: jsonb("social_links")
    .$type<Record<string, string>>()
    .default({}),
  announcementBar: text("announcement_bar"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  defaultCurrency: varchar("default_currency", { length: 3 })
    .notNull()
    .default("USD"),
  enabledCurrencies: jsonb("enabled_currencies")
    .$type<string[]>()
    .default(["USD", "EUR", "GBP"]),
  cppEnabled: boolean("cpp_enabled").notNull().default(false),
  cppLabel: varchar("cpp_label", { length: 200 }).default("Checkout Protection Plan"),
  cppPrice: numeric("cpp_price", { precision: 10, scale: 2 }).default("0.99"),
  cppDescription: text("cpp_description").default("Protect your purchase with instant replacement if your key doesn't work."),
  processingFeePercent: numeric("processing_fee_percent", { precision: 5, scale: 2 }).default("0"),
  processingFeeFixed: numeric("processing_fee_fixed", { precision: 10, scale: 2 }).default("0"),
  trustpilotUrl: text("trustpilot_url"),
  metaTitleTemplate: varchar("meta_title_template", { length: 300 }),
  metaDescription: text("meta_description"),
  smtpHost: varchar("smtp_host", { length: 255 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 255 }),
  smtpPass: text("smtp_pass"),
  smtpFrom: varchar("smtp_from", { length: 255 }),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
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
