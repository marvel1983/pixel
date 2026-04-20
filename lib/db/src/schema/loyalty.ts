import {
  pgTable,
  serial,
  integer,
  varchar,
  numeric,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";


export const loyaltyAccounts = pgTable("loyalty_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  pointsBalance: integer("points_balance").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  tier: varchar("tier", { length: 20 }).notNull().default("BRONZE"),
  tierMultiplier: numeric("tier_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("1.00"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id")
    .notNull()
    .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 30 }).notNull(),
  points: integer("points").notNull(),
  balance: integer("balance").notNull(),
  description: text("description").notNull(),
  orderId: integer("order_id"),
  reviewId: integer("review_id"),
  adminNote: text("admin_note"),
  expiresAt: timestamp("expires_at"),
  warningEmailSentAt: timestamp("warning_email_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  accountIdIdx: index("loyalty_transactions_account_id_idx").on(t.accountId),
}));

export const loyaltySettings = pgTable("loyalty_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  pointsPerDollar: integer("points_per_dollar").notNull().default(10),
  redemptionRate: numeric("redemption_rate", { precision: 10, scale: 4 })
    .notNull()
    .default("0.01"),
  welcomeBonus: integer("welcome_bonus").notNull().default(100),
  reviewBonus: integer("review_bonus").notNull().default(50),
  minRedeemPoints: integer("min_redeem_points").notNull().default(500),
  maxRedeemPercent: integer("max_redeem_percent").notNull().default(50),
  bronzeThreshold: integer("bronze_threshold").notNull().default(0),
  silverThreshold: integer("silver_threshold").notNull().default(1000),
  goldThreshold: integer("gold_threshold").notNull().default(5000),
  platinumThreshold: integer("platinum_threshold").notNull().default(15000),
  bronzeMultiplier: numeric("bronze_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("1.00"),
  silverMultiplier: numeric("silver_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("1.25"),
  goldMultiplier: numeric("gold_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("1.50"),
  platinumMultiplier: numeric("platinum_multiplier", { precision: 4, scale: 2 })
    .notNull()
    .default("2.00"),
  pointsExpiryDays: integer("points_expiry_days").default(0),
  expiryWarningDays: integer("expiry_warning_days").notNull().default(30),
  birthdayBonus: integer("birthday_bonus").notNull().default(200),
  referralBonus: integer("referral_bonus").notNull().default(500),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const loyaltyEvents = pgTable("loyalty_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  multiplier: numeric("multiplier", { precision: 4, scale: 2 }).notNull().default("2"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type LoyaltySettingsRow = typeof loyaltySettings.$inferSelect;
export type LoyaltyEvent = typeof loyaltyEvents.$inferSelect;
