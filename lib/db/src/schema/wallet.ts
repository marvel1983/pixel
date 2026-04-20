import {
  pgTable, serial, integer, timestamp, numeric, text, pgEnum, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const walletAccounts = pgTable("wallet_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id).unique(),
  balanceUsd: numeric("balance_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  totalDeposited: numeric("total_deposited", { precision: 10, scale: 2 }).notNull().default("0"),
  totalSpent: numeric("total_spent", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTxTypeEnum = pgEnum("wallet_tx_type", [
  "CREDIT", "DEBIT", "REFUND", "BONUS", "TOPUP", "PURCHASE",
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: walletTxTypeEnum("type").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("wallet_transactions_user_id_idx").on(t.userId),
}));

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true, createdAt: true,
});

export type WalletAccount = typeof walletAccounts.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
