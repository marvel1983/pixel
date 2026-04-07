import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletAccounts, walletTransactions } from "@workspace/db/schema";
import type { WalletAccount } from "@workspace/db/schema";

export async function getOrCreateWallet(userId: number): Promise<WalletAccount> {
  const [existing] = await db.select().from(walletAccounts)
    .where(eq(walletAccounts.userId, userId)).limit(1);
  if (existing) return existing;
  try {
    const [created] = await db.insert(walletAccounts)
      .values({ userId }).returning();
    return created;
  } catch {
    const [retry] = await db.select().from(walletAccounts)
      .where(eq(walletAccounts.userId, userId)).limit(1);
    if (retry) return retry;
    throw new Error("Failed to create wallet");
  }
}

export async function getWalletBalance(userId: number): Promise<number> {
  const wallet = await getOrCreateWallet(userId);
  return parseFloat(wallet.balanceUsd);
}

export async function creditWallet(
  userId: number, amount: number, type: "TOPUP" | "REFUND" | "BONUS" | "CREDIT",
  description: string, referenceId?: string,
): Promise<{ wallet: WalletAccount; tx: typeof walletTransactions.$inferSelect }> {
  const wallet = await getOrCreateWallet(userId);

  const amtSql = sql`${amount.toFixed(2)}::numeric`;
  return db.transaction(async (tx) => {
    const baseSet = { balanceUsd: sql`${walletAccounts.balanceUsd}::numeric + ${amtSql}`, updatedAt: new Date() };
    const setFields = type === "TOPUP"
      ? { ...baseSet, totalDeposited: sql`${walletAccounts.totalDeposited}::numeric + ${amtSql}` }
      : type === "REFUND"
        ? { ...baseSet, totalSpent: sql`GREATEST(${walletAccounts.totalSpent}::numeric - ${amtSql}, 0)` }
        : baseSet;
    const [updated] = await tx.update(walletAccounts).set(setFields)
      .where(eq(walletAccounts.id, wallet.id)).returning();

    const [txn] = await tx.insert(walletTransactions).values({
      userId, type, amountUsd: amount.toFixed(2),
      balanceAfter: updated.balanceUsd, description, referenceId,
    }).returning();

    return { wallet: updated, tx: txn };
  });
}

export async function debitWallet(
  userId: number, amount: number, type: "PURCHASE" | "DEBIT",
  description: string, referenceId?: string,
): Promise<{ wallet: WalletAccount; tx: typeof walletTransactions.$inferSelect }> {
  const wallet = await getOrCreateWallet(userId);

  return db.transaction(async (tx) => {
    const [updated] = await tx.update(walletAccounts).set({
      balanceUsd: sql`${walletAccounts.balanceUsd}::numeric - ${amount.toFixed(2)}::numeric`,
      totalSpent: sql`${walletAccounts.totalSpent}::numeric + ${amount.toFixed(2)}::numeric`,
      updatedAt: new Date(),
    }).where(
      sql`${walletAccounts.id} = ${wallet.id} AND ${walletAccounts.balanceUsd}::numeric >= ${amount.toFixed(2)}::numeric`
    ).returning();

    if (!updated) {
      throw new Error("Insufficient wallet balance");
    }

    const [txn] = await tx.insert(walletTransactions).values({
      userId, type, amountUsd: `-${amount.toFixed(2)}`,
      balanceAfter: updated.balanceUsd, description, referenceId,
    }).returning();

    return { wallet: updated, tx: txn };
  });
}
