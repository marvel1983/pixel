import {
  pgTable,
  serial,
  integer,
  timestamp,
  numeric,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const walletTxTypeEnum = pgEnum("wallet_tx_type", [
  "CREDIT",
  "DEBIT",
  "REFUND",
  "BONUS",
]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  type: walletTxTypeEnum("type").notNull(),
  amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", {
    precision: 10,
    scale: 2,
  }).notNull(),
  description: text("description"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletTransactionSchema = createInsertSchema(
  walletTransactions,
).omit({
  id: true,
  createdAt: true,
});

export type InsertWalletTransaction = z.infer<
  typeof insertWalletTransactionSchema
>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
