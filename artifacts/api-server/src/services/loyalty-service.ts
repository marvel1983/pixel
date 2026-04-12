import { eq, and, sql, gte, lte, isNull, not, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  loyaltyAccounts,
  loyaltyTransactions,
  loyaltySettings,
  loyaltyEvents,
  users,
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
  extra?: { orderId?: number; reviewId?: number; adminNote?: string; expiresAt?: Date },
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
      expiresAt: extra?.expiresAt ?? null,
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

/** Returns the highest active event multiplier (or 1.0 if none). */
export async function getActiveEventMultiplier(): Promise<number> {
  const now = new Date();
  const events = await db
    .select({ multiplier: loyaltyEvents.multiplier })
    .from(loyaltyEvents)
    .where(
      and(
        eq(loyaltyEvents.active, true),
        lte(loyaltyEvents.startsAt, now),
        gte(loyaltyEvents.endsAt, now),
      ),
    );
  if (events.length === 0) return 1.0;
  return Math.max(...events.map((e) => parseFloat(e.multiplier)));
}

export async function awardOrderPoints(userId: number, orderId: number, totalUsd: number) {
  const config = await getLoyaltyConfig();
  if (!config?.enabled) return;

  const account = await getOrCreateAccount(userId);

  // Idempotency guard: skip if points already awarded for this order
  const [existing] = await db
    .select({ id: loyaltyTransactions.id })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.accountId, account.id),
        eq(loyaltyTransactions.type, "ORDER"),
        eq(loyaltyTransactions.orderId, orderId),
      ),
    )
    .limit(1);
  if (existing) return;

  // Check if this is the user's first order (before awarding)
  const [{ orderCount }] = await db
    .select({ orderCount: sql<number>`count(*)::int` })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.accountId, account.id),
        eq(loyaltyTransactions.type, "ORDER"),
      ),
    );
  const isFirstOrder = orderCount === 0;

  const tierMultiplier = getConfigMultiplier(account.tier, config);
  const eventMultiplier = await getActiveEventMultiplier();
  const rawPoints = Math.floor(totalUsd * config.pointsPerDollar);
  const points = Math.floor(rawPoints * tierMultiplier * eventMultiplier);
  if (points <= 0) return;

  // Compute expiry if configured
  let expiresAt: Date | undefined;
  if (config.pointsExpiryDays && config.pointsExpiryDays > 0) {
    expiresAt = new Date(Date.now() + config.pointsExpiryDays * 86_400_000);
  }

  await addPoints(account.id, points, "ORDER", `Earned ${points} pts from order`, {
    orderId,
    expiresAt,
  });

  // Referral bonus: if this is the buyer's first order and they were referred
  if (isFirstOrder) {
    const [userRow] = await db
      .select({ referredByUserId: users.referredByUserId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.referredByUserId) {
      try {
        const referralBonus = config.referralBonus ?? 500;
        const referrerAccount = await getOrCreateAccount(userRow.referredByUserId);
        await addPoints(
          referrerAccount.id,
          referralBonus,
          "REFERRAL",
          "Referral bonus — friend made first purchase",
        );
        logger.info({ referrerId: userRow.referredByUserId, referredUserId: userId }, "Referral bonus awarded");
      } catch (err) {
        logger.error({ err, referredByUserId: userRow.referredByUserId }, "Failed to award referral bonus (non-fatal)");
      }
    }
  }
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

export async function reverseOrderLoyaltyPoints(
  orderId: number,
  refundAmountUsd: number,
  orderTotalUsd: number,
): Promise<void> {
  // Find the original ORDER transaction for this orderId
  const [originalTx] = await db
    .select()
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.type, "ORDER"),
        eq(loyaltyTransactions.orderId, orderId),
      ),
    )
    .limit(1);

  if (!originalTx) return; // No points were awarded, nothing to reverse

  const originalPoints = originalTx.points;

  // Calculate points to reverse
  let pointsToReverse: number;
  if (refundAmountUsd >= orderTotalUsd) {
    // Full refund: reverse all original points
    pointsToReverse = originalPoints;
  } else {
    // Partial refund: reverse proportionally
    pointsToReverse = Math.floor(originalPoints * (refundAmountUsd / orderTotalUsd));
  }

  if (pointsToReverse <= 0) return;

  // Load the account to cap deduction at current balance (cannot go negative)
  const [account] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.id, originalTx.accountId))
    .limit(1);

  if (!account) return;

  const actualDeduction = Math.min(pointsToReverse, account.pointsBalance);
  if (actualDeduction <= 0) return;

  const newBalance = account.pointsBalance - actualDeduction;

  // Update the account balance (do NOT change lifetimePoints — tier only goes up)
  await db
    .update(loyaltyAccounts)
    .set({ pointsBalance: newBalance, updatedAt: new Date() })
    .where(eq(loyaltyAccounts.id, account.id));

  // Insert REFUND transaction with negative points
  await db.insert(loyaltyTransactions).values({
    accountId: account.id,
    type: "REFUND",
    points: -actualDeduction,
    balance: newBalance,
    description: `Reversed ${actualDeduction} pts due to refund on order #${orderId}`,
    orderId,
  });

  logger.info({ orderId, pointsReversed: actualDeduction, accountId: account.id }, "Loyalty points reversed for refund");
}

export async function processExpiredPoints(): Promise<void> {
  const config = await getLoyaltyConfig();
  if (!config) return;

  const BATCH_SIZE = 50;
  let offset = 0;

  while (true) {
    const expiredTxs = await db
      .select()
      .from(loyaltyTransactions)
      .where(
        and(
          lte(loyaltyTransactions.expiresAt, new Date()),
          gte(loyaltyTransactions.points, 1),
          not(inArray(loyaltyTransactions.type, ["EXPIRED", "REFUND", "REVERSAL"])),
          // Only expire after warning was sent, or if expiryWarningDays is 0
          config.expiryWarningDays === 0
            ? sql`1=1`
            : sql`${loyaltyTransactions.warningEmailSentAt} IS NOT NULL`,
        ),
      )
      .limit(BATCH_SIZE)
      .offset(offset);

    if (expiredTxs.length === 0) break;

    for (const tx of expiredTxs) {
      try {
        const [account] = await db
          .select()
          .from(loyaltyAccounts)
          .where(eq(loyaltyAccounts.id, tx.accountId))
          .limit(1);

        if (!account) continue;

        const deduction = Math.min(tx.points, account.pointsBalance);
        if (deduction <= 0) continue;

        const newBalance = account.pointsBalance - deduction;

        await db
          .update(loyaltyAccounts)
          .set({ pointsBalance: newBalance, updatedAt: new Date() })
          .where(eq(loyaltyAccounts.id, account.id));

        await db.insert(loyaltyTransactions).values({
          accountId: account.id,
          type: "EXPIRED",
          points: -deduction,
          balance: newBalance,
          description: `Expired ${deduction} pts (original transaction #${tx.id})`,
          orderId: tx.orderId,
        });

        logger.info({ txId: tx.id, accountId: account.id, deduction }, "Loyalty points expired");
      } catch (err) {
        logger.error({ err, txId: tx.id }, "Failed to process expired loyalty transaction");
      }
    }

    if (expiredTxs.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
}

export async function processBirthdayBonuses(): Promise<void> {
  const config = await getLoyaltyConfig();
  const birthdayBonus = config?.birthdayBonus ?? 200;
  if (!birthdayBonus || birthdayBonus <= 0) return;

  // Find users whose birthday is today and who have a loyalty account
  const todayUsers = await db
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
    })
    .from(users)
    .innerJoin(loyaltyAccounts, eq(loyaltyAccounts.userId, users.id))
    .where(
      and(
        sql`EXTRACT(MONTH FROM ${users.dateOfBirth}) = EXTRACT(MONTH FROM NOW())`,
        sql`EXTRACT(DAY FROM ${users.dateOfBirth}) = EXTRACT(DAY FROM NOW())`,
      ),
    );

  if (todayUsers.length === 0) return;

  const { enqueueEmail } = await import("../lib/email/queue");

  for (const user of todayUsers) {
    try {
      const account = await getOrCreateAccount(user.userId);

      // Check if already awarded this year
      const [alreadyAwarded] = await db
        .select({ id: loyaltyTransactions.id })
        .from(loyaltyTransactions)
        .where(
          and(
            eq(loyaltyTransactions.accountId, account.id),
            eq(loyaltyTransactions.type, "BIRTHDAY"),
            sql`EXTRACT(YEAR FROM ${loyaltyTransactions.createdAt}) = EXTRACT(YEAR FROM NOW())`,
          ),
        )
        .limit(1);

      if (alreadyAwarded) continue;

      await addPoints(account.id, birthdayBonus, "BIRTHDAY", `Birthday bonus 🎂`);

      if (user.email) {
        const subject = `Happy Birthday! You've received ${birthdayBonus} loyalty points 🎂`;
        const html = `<h2>Happy Birthday, ${user.firstName ?? "there"}! 🎂</h2>
          <p>To celebrate your special day, we've added <strong>${birthdayBonus} bonus points</strong> to your loyalty account!</p>
          <p><a href="/account/loyalty">View your points balance</a></p>`;
        await enqueueEmail(user.email, subject, html, { type: "birthday-bonus", userId: user.userId });
      }

      logger.info({ userId: user.userId, points: birthdayBonus }, "Birthday bonus awarded");
    } catch (err) {
      logger.error({ err, userId: user.userId }, "Failed to award birthday bonus");
    }
  }
}

export async function sendExpiryWarningEmails(): Promise<void> {
  const config = await getLoyaltyConfig();
  if (!config) return;
  if (!config.pointsExpiryDays || config.pointsExpiryDays === 0) return; // Expiry disabled

  const warningDays = config.expiryWarningDays ?? 30;
  const warningCutoff = new Date(Date.now() + warningDays * 86_400_000);

  // Find transactions expiring within the warning window that haven't been warned yet
  const expiringTxs = await db
    .select()
    .from(loyaltyTransactions)
    .where(
      and(
        gte(loyaltyTransactions.expiresAt, new Date()),
        lte(loyaltyTransactions.expiresAt, warningCutoff),
        gte(loyaltyTransactions.points, 1),
        isNull(loyaltyTransactions.warningEmailSentAt),
        not(inArray(loyaltyTransactions.type, ["EXPIRED", "REFUND", "REVERSAL"])),
      ),
    );

  if (expiringTxs.length === 0) return;

  // Group by accountId: aggregate total expiring points and earliest expiry date
  const byAccount = new Map<number, { totalPoints: number; earliestExpiry: Date; txIds: number[] }>();
  for (const tx of expiringTxs) {
    if (!tx.expiresAt) continue;
    const entry = byAccount.get(tx.accountId);
    if (!entry) {
      byAccount.set(tx.accountId, { totalPoints: tx.points, earliestExpiry: tx.expiresAt, txIds: [tx.id] });
    } else {
      entry.totalPoints += tx.points;
      if (tx.expiresAt < entry.earliestExpiry) entry.earliestExpiry = tx.expiresAt;
      entry.txIds.push(tx.id);
    }
  }

  const { enqueueEmail } = await import("../lib/email/queue");

  for (const [accountId, { totalPoints, earliestExpiry, txIds }] of byAccount) {
    try {
      // Get user email via account
      const [account] = await db
        .select({ userId: loyaltyAccounts.userId })
        .from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.id, accountId))
        .limit(1);
      if (!account) continue;

      const [user] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, account.userId))
        .limit(1);
      if (!user?.email) continue;

      const expiryDateStr = earliestExpiry.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const subject = `Your ${totalPoints} loyalty points expire on ${expiryDateStr}`;
      const html = `<h2>Your loyalty points are expiring soon!</h2>
        <p>Hi ${user.firstName ?? "there"},</p>
        <p>You have <strong>${totalPoints} points</strong> expiring on <strong>${expiryDateStr}</strong>.</p>
        <p>Use your points before they expire to save on your next purchase.</p>
        <p><a href="/account/loyalty">View your points balance</a></p>`;

      await enqueueEmail(user.email, subject, html, { type: "loyalty-expiry-warning", accountId });

      // Mark all those transactions as warned
      for (const txId of txIds) {
        await db
          .update(loyaltyTransactions)
          .set({ warningEmailSentAt: new Date() })
          .where(eq(loyaltyTransactions.id, txId));
      }

      logger.info({ accountId, totalPoints, earliestExpiry }, "Sent loyalty expiry warning email");
    } catch (err) {
      logger.error({ err, accountId }, "Failed to send loyalty expiry warning email");
    }
  }
}
