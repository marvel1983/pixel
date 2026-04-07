import { pgTable, serial, varchar, text, numeric, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { users } from "./users";

export const giftCardStatusEnum = pgEnum("gift_card_status", [
  "ACTIVE",
  "REDEEMED",
  "EXPIRED",
  "DEACTIVATED",
]);

export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  initialAmountUsd: numeric("initial_amount_usd", { precision: 10, scale: 2 }).notNull(),
  balanceUsd: numeric("balance_usd", { precision: 10, scale: 2 }).notNull(),
  status: giftCardStatusEnum("status").notNull().default("ACTIVE"),
  purchasedByUserId: integer("purchased_by_user_id").references(() => users.id),
  purchaseOrderId: integer("purchase_order_id").references(() => orders.id),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientName: varchar("recipient_name", { length: 200 }),
  senderName: varchar("sender_name", { length: 200 }),
  personalMessage: text("personal_message"),
  isManual: boolean("is_manual").notNull().default(false),
  emailSent: boolean("email_sent").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const giftCardRedemptions = pgTable("gift_card_redemptions", {
  id: serial("id").primaryKey(),
  giftCardId: integer("gift_card_id").notNull().references(() => giftCards.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GiftCard = typeof giftCards.$inferSelect;
export type GiftCardRedemption = typeof giftCardRedemptions.$inferSelect;
