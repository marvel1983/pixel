import { pgTable, serial, varchar, boolean, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  orderAlerts: boolean("order_alerts").notNull().default(true),
  orderAlertsEmail: boolean("order_alerts_email").notNull().default(true),
  stockAlerts: boolean("stock_alerts").notNull().default(true),
  stockThreshold: varchar("stock_threshold", { length: 10 }).notNull().default("5"),
  customerAlerts: boolean("customer_alerts").notNull().default(true),
  reviewAlerts: boolean("review_alerts").notNull().default(true),
  reviewMinRating: varchar("review_min_rating", { length: 5 }).notNull().default("1"),
  claimAlerts: boolean("claim_alerts").notNull().default(true),
  paymentAlerts: boolean("payment_alerts").notNull().default(true),
  paymentFailedOnly: boolean("payment_failed_only").notNull().default(false),
  systemAlerts: boolean("system_alerts").notNull().default(true),
  dailyDigest: boolean("daily_digest").notNull().default(false),
  dailyDigestTime: varchar("daily_digest_time", { length: 5 }).notNull().default("09:00"),
  dailyDigestRecipients: jsonb("daily_digest_recipients").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const seoTracking = pgTable("seo_tracking", {
  id: serial("id").primaryKey(),
  googleAnalyticsId: varchar("google_analytics_id", { length: 50 }),
  gtmId: varchar("gtm_id", { length: 50 }),
  facebookPixelId: varchar("facebook_pixel_id", { length: 50 }),
  googleVerificationCode: varchar("google_verification_code", { length: 200 }),
  socialShareImage: text("social_share_image"),
  robotsTxt: text("robots_txt").notNull().default("User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml"),
  customHeadScripts: text("custom_head_scripts"),
  customBodyScripts: text("custom_body_scripts"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceMessage: text("maintenance_message").notNull().default("We are currently performing maintenance. Please check back soon."),
  maintenanceEstimate: varchar("maintenance_estimate", { length: 100 }),
  maintenanceBypassIps: jsonb("maintenance_bypass_ips").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
