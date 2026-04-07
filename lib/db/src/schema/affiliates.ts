import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { orders } from "./orders";

export const affiliateStatusEnum = pgEnum("affiliate_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
]);

export const commissionStatusEnum = pgEnum("commission_status", [
  "PENDING",
  "HELD",
  "APPROVED",
  "PAID",
  "REVERSED",
]);

export const affiliateProfiles = pgTable("affiliate_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  referralCode: varchar("referral_code", { length: 50 }).notNull().unique(),
  status: affiliateStatusEnum("status").notNull().default("PENDING"),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull().default("5.00"),
  websiteUrl: text("website_url"),
  socialMedia: text("social_media"),
  promotionMethod: text("promotion_method"),
  applicationNote: text("application_note"),
  adminNote: text("admin_note"),
  totalEarned: numeric("total_earned", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).notNull().default("0.00"),
  pendingBalance: numeric("pending_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalClicks: integer("total_clicks").notNull().default(0),
  totalOrders: integer("total_orders").notNull().default(0),
  paypalEmail: varchar("paypal_email", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const affiliateClicks = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliateProfiles.id),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  referrerUrl: text("referrer_url"),
  landingPage: text("landing_page"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").notNull().references(() => affiliateProfiles.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  orderTotal: numeric("order_total", { precision: 12, scale: 2 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull(),
  status: commissionStatusEnum("status").notNull().default("HELD"),
  heldUntil: timestamp("held_until"),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  reversedAt: timestamp("reversed_at"),
  reversalReason: text("reversal_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const affiliateSettings = pgTable("affiliate_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  defaultCommissionRate: numeric("default_commission_rate", { precision: 5, scale: 2 }).notNull().default("5.00"),
  minimumPayout: numeric("minimum_payout", { precision: 10, scale: 2 }).notNull().default("25.00"),
  holdPeriodDays: integer("hold_period_days").notNull().default(14),
  autoApprove: boolean("auto_approve").notNull().default(false),
  cookieDurationDays: integer("cookie_duration_days").notNull().default(30),
  programDescription: text("program_description"),
  termsAndConditions: text("terms_and_conditions"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AffiliateProfile = typeof affiliateProfiles.$inferSelect;
export type AffiliateClick = typeof affiliateClicks.$inferSelect;
export type AffiliateCommission = typeof affiliateCommissions.$inferSelect;
export type AffiliateSettings = typeof affiliateSettings.$inferSelect;
