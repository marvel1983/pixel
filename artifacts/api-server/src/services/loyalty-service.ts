import { eq, and, sql, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  loyaltyAccounts,
  loyaltyTransactions,
  loyaltySettings,
} from "@workspace/db/schema";
import { logger } from "../lib/logger";

const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

export async function getLoyaltyConfig() {
  const [config] = await db.select().from(loyaltySettings).limit(1);
  return config ?? null;
}

export async function getOrCreateAccount(userId: number) {
  let [account] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.userId, userId))
    .limit(1);
  if (!account) {
    [account] = await db
      .insert(loyaltyAccounts)
      .values({ userId })
      .returning();
  }
  return account;
}

export async function addPoints(
  accountId: number,
  points: number,
  type: string,
  description: string,
  extra?: { orderId?: number; reviewId?: number; adminNote?: string },
) {
  const [account] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.id, accountId))
    .limit(1);
  if (!account) throw new Error("Loyalty account not found");

  const newBalance = account.pointsBalance + points;
  const newLifetime = account.lifetimePoints + Math.max(0, points);

  await db
    .update(loyaltyAccounts)
    .set({
      pointsBalance: newBalance,
      lifetimePoints: newLifetime,
      updatedAt: new Date(),
    })
    .where(eq(loyaltyAccounts.id, accountId));

  const [tx] = await db
    .insert(loyaltyTransactions)
    .values({
      accountId,
      type,
      points,
      balance: newBalance,
      description,
      orderId: extra?.orderId,
      reviewId: extra?.reviewId,
      adminNote: extra?.adminNote,
    })
    .returning();

  await updateTier(accountId);
  return tx;
}

export async function restorePoints(accountId: number, points: number, description: string, orderId?: number) {
  const [account] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.id, accountId)).limit(1);
  if (!account) return;
  const newBalance = account.pointsBalance + points;
  await db.update(loyaltyAccounts)
    .set({ pointsBalance: newBalance, updatedAt: new Date() })
    .where(eq(loyaltyAccounts.id, accountId));
  await db.insert(loyaltyTransactions).values({
    accountId, type: "REFUND", points, balance: newBalance, description, orderId,
  });
}

export async function redeemPoints(accountId: number, points: number, orderId?: number) {
  const config = await getLoyaltyConfig();
  if (!config?.enabled) throw new Error("Loyalty program not active");
  if (points < config.minRedeemPoints) throw new Error("Below minimum redemption");

  const [updated] = await db
    .update(loyaltyAccounts)
    .set({
      pointsBalance: sql`${loyaltyAccounts.pointsBalance} - ${points}`,
      updatedAt: new Date(),
    })
    .where(and(eq(loyaltyAccounts.id, accountId), gte(loyaltyAccounts.pointsBalance, points)))
    .returning({ newBalance: loyaltyAccounts.pointsBalance });

  if (!updated) throw new Error("Insufficient points");

  const [tx] = await db
    .insert(loyaltyTransactions)
    .values({
      accountId,
      type: "REDEEM",
      points: -points,
      balance: updated.newBalance,
      description: `Redeemed ${points} points at checkout`,
      orderId,
    })
    .returning();

  return tx;
}

async function updateTier(accountId: number) {
  const config = await getLoyaltyConfig();
  if (!config) return;

  const [account] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.id, accountId))
    .limit(1);
  if (!account) return;

  const lp = account.lifetimePoints;
  let tier: (typeof TIERS)[number] = "BRONZE";
  let multiplier = config.bronzeMultiplier;

  if (lp >= config.platinumThreshold) {
    tier = "PLATINUM";
    multiplier = config.platinumMultiplier;
  } else if (lp >= config.goldThreshold) {
    tier = "GOLD";
    multiplier = config.goldMultiplier;
  } else if (lp >= config.silverThreshold) {
    tier = "SILVER";
    multiplier = config.silverMultiplier;
  }

  if (account.tier !== tier) {
    await db
      .update(loyaltyAccounts)
      .set({ tier, tierMultiplier: multiplier, updatedAt: new Date() })
      .where(eq(loyaltyAccounts.id, accountId));
    logger.info({ accountId, oldTier: account.tier, newTier: tier }, "Loyalty tier upgraded");
  }
}

function getConfigMultiplier(tier: string, config: NonNullable<Awaited<ReturnType<typeof getLoyaltyConfig>>>) {
  const map: Record<string, string> = {
    BRONZE: config.bronzeMultiplier, SILVER: config.silverMultiplier,
    GOLD: config.goldMultiplier, PLATINUM: config.platinumMultiplier,
  };
  return parseFloat(map[tier] ?? config.bronzeMultiplier);
}

export async function awardOrderPoints(userId: number, orderId: number, totalUsd: number) {
  const config = await getLoyaltyConfig();
  if (!config?.enabled) return;

  const account = await getOrCreateAccount(userId);
  const multiplier = getConfigMultiplier(account.tier, config);
  const rawPoints = Math.floor(totalUsd * config.pointsPerDollar);
  const points = Math.floor(rawPoints * multiplier);
  if (points <= 0) return;

  await addPoints(account.id, points, "ORDER", `Earned ${points} pts from order`, {
    orderId,
  });
}

export async function awardWelcomeBonus(userId: number) {
  const config = await getLoyaltyConfig();
  if (!config?.enabled || config.welcomeBonus <= 0) return;

  const account = await getOrCreateAccount(userId);
  await addPoints(
    account.id,
    config.welcomeBonus,
    "WELCOME",
    `Welcome bonus: ${config.welcomeBonus} pts`,
  );
}

export async function awardReviewBonus(userId: number, reviewId: number) {
  const config = await getLoyaltyConfig();
  if (!config?.enabled || config.reviewBonus <= 0) return;

  const account = await getOrCreateAccount(userId);

  const [existing] = await db
    .select({ id: loyaltyTransactions.id })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.accountId, account.id),
        eq(loyaltyTransactions.type, "REVIEW"),
        eq(loyaltyTransactions.reviewId, reviewId),
      ),
    )
    .limit(1);
  if (existing) return;

  await addPoints(
    account.id,
    config.reviewBonus,
    "REVIEW",
    `Review bonus: ${config.reviewBonus} pts`,
    { reviewId },
  );
}

export function pointsToDiscount(points: number, config: { redemptionRate: string }) {
  return Math.round(points * parseFloat(config.redemptionRate) * 100) / 100;
}
