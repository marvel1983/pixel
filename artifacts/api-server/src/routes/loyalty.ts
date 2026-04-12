import { Router } from "express";
import { eq, desc, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { loyaltyAccounts, loyaltyTransactions, loyaltySettings, users } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import {
  getLoyaltyConfig,
  getOrCreateAccount,
  pointsToDiscount,
  addPoints,
} from "../services/loyalty-service";
import { enqueueEmail } from "../lib/email/queue";

const router = Router();

router.get("/loyalty/config", async (_req, res) => {
  const config = await getLoyaltyConfig();
  if (!config || !config.enabled) {
    res.json({ enabled: false });
    return;
  }
  res.json({
    enabled: true,
    pointsPerDollar: config.pointsPerDollar,
    redemptionRate: config.redemptionRate,
    minRedeemPoints: config.minRedeemPoints,
    maxRedeemPercent: config.maxRedeemPercent,
    tiers: {
      BRONZE: { threshold: config.bronzeThreshold, multiplier: config.bronzeMultiplier },
      SILVER: { threshold: config.silverThreshold, multiplier: config.silverMultiplier },
      GOLD: { threshold: config.goldThreshold, multiplier: config.goldMultiplier },
      PLATINUM: { threshold: config.platinumThreshold, multiplier: config.platinumMultiplier },
    },
  });
});

router.get("/loyalty/account", requireAuth, async (req, res) => {
  const config = await getLoyaltyConfig();
  if (!config?.enabled) {
    res.json({ enabled: false });
    return;
  }

  const account = await getOrCreateAccount(req.user!.userId);
  const nextTier = getNextTier(account.tier, config);
  const currentTierThreshold = getCurrentTierThreshold(account.tier, config);

  res.json({
    enabled: true,
    pointsBalance: account.pointsBalance,
    lifetimePoints: account.lifetimePoints,
    tier: account.tier,
    tierMultiplier: account.tierMultiplier,
    currentTierThreshold,
    nextTier: nextTier?.name ?? null,
    nextTierThreshold: nextTier?.threshold ?? null,
    pointsToNextTier: nextTier
      ? Math.max(0, nextTier.threshold - account.lifetimePoints)
      : 0,
    discountValue: pointsToDiscount(account.pointsBalance, config),
  });
});

router.get("/loyalty/transactions", requireAuth, async (req, res) => {
  const config = await getLoyaltyConfig();
  if (!config?.enabled) { res.json({ transactions: [], total: 0, page: 1, limit: 20 }); return; }

  const account = await getOrCreateAccount(req.user!.userId);
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: count() })
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.accountId, account.id));

  const txs = await db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.accountId, account.id))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ transactions: txs, total, page, limit });
});

router.post("/loyalty/preview-redeem", requireAuth, async (req, res) => {
  const config = await getLoyaltyConfig();
  if (!config?.enabled) { res.status(400).json({ error: "Loyalty not active" }); return; }

  const { points, subtotal } = req.body;
  const pts = parseInt(points) || 0;
  const sub = parseFloat(subtotal) || 0;

  const account = await getOrCreateAccount(req.user!.userId);
  if (pts > account.pointsBalance) {
    res.status(400).json({ error: "Insufficient points" });
    return;
  }
  if (pts < config.minRedeemPoints) {
    res.status(400).json({ error: `Minimum ${config.minRedeemPoints} points required` });
    return;
  }

  const discount = pointsToDiscount(pts, config);
  const maxDiscount = sub * (config.maxRedeemPercent / 100);
  const actualDiscount = Math.min(discount, maxDiscount);
  const actualPoints = Math.ceil(actualDiscount / parseFloat(config.redemptionRate));

  res.json({
    pointsUsed: actualPoints,
    discountAmount: actualDiscount,
    remainingBalance: account.pointsBalance - actualPoints,
  });
});

/** PUT /loyalty/birthday — set own date of birth */
router.put("/loyalty/birthday", requireAuth, async (req, res) => {
  const { dateOfBirth } = req.body;
  if (!dateOfBirth || typeof dateOfBirth !== "string") {
    res.status(400).json({ error: "dateOfBirth required (YYYY-MM-DD)" });
    return;
  }
  const parsed = new Date(dateOfBirth);
  if (isNaN(parsed.getTime())) {
    res.status(400).json({ error: "Invalid date format" });
    return;
  }
  if (parsed >= new Date()) {
    res.status(400).json({ error: "Date of birth must be in the past" });
    return;
  }
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 120);
  if (parsed < minDate) {
    res.status(400).json({ error: "Date of birth cannot be more than 120 years ago" });
    return;
  }
  await db
    .update(users)
    .set({ dateOfBirth, updatedAt: new Date() })
    .where(eq(users.id, req.user!.userId));
  res.json({ success: true });
});

/** GET /loyalty/referral — get referral info */
router.get("/loyalty/referral", requireAuth, async (req, res) => {
  const config = await getLoyaltyConfig();
  const referralBonus = config?.referralBonus ?? 500;
  const userId = req.user!.userId;
  const referralCode = `REF${userId}`;
  const [{ referrals }] = await db
    .select({ referrals: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.referredByUserId, userId));
  res.json({ referralCode, referralBonus, referrals });
});

/** POST /loyalty/gift — gift points to another customer */
router.post("/loyalty/gift", requireAuth, async (req, res) => {
  const { toEmail, points, message } = req.body;

  if (!toEmail || typeof toEmail !== "string") {
    res.status(400).json({ error: "toEmail required" });
    return;
  }
  const pts = parseInt(points);
  if (!Number.isInteger(pts) || pts < 50) {
    res.status(400).json({ error: "Points must be an integer >= 50" });
    return;
  }

  const senderId = req.user!.userId;

  // Get sender info
  const [senderUser] = await db
    .select({ email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1);
  if (!senderUser) {
    res.status(404).json({ error: "Sender not found" });
    return;
  }

  // Cannot gift to yourself
  if (senderUser.email?.toLowerCase() === toEmail.toLowerCase()) {
    res.status(400).json({ error: "Cannot gift points to yourself" });
    return;
  }

  // Find recipient
  const [recipientUser] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.email, toEmail.toLowerCase()))
    .limit(1);
  if (!recipientUser) {
    res.status(404).json({ error: "Recipient not found" });
    return;
  }

  // Check sender balance
  const senderAccount = await getOrCreateAccount(senderId);
  if (senderAccount.pointsBalance < pts) {
    res.status(400).json({ error: "Insufficient points balance" });
    return;
  }

  // Deduct from sender
  await addPoints(senderAccount.id, -pts, "GIFT_SENT", `Points gifted to ${toEmail}`);

  // Award to recipient
  const recipientAccount = await getOrCreateAccount(recipientUser.id);
  await addPoints(recipientAccount.id, pts, "GIFT_RECEIVED", `Points received from ${senderUser.email}`);

  // Send emails
  const msgNote = message ? `<p><em>Message: "${message}"</em></p>` : "";
  await enqueueEmail(
    recipientUser.email!,
    `You received ${pts} loyalty points!`,
    `<h2>You've received ${pts} loyalty points!</h2>
    <p>${senderUser.firstName ?? senderUser.email} sent you <strong>${pts} points</strong>.</p>
    ${msgNote}
    <p><a href="/account/loyalty">View your points balance</a></p>`,
    { type: "loyalty-gift-received", fromUserId: senderId, toUserId: recipientUser.id },
  );
  await enqueueEmail(
    senderUser.email!,
    `You gifted ${pts} loyalty points to ${toEmail}`,
    `<h2>Points gift confirmed!</h2>
    <p>You successfully sent <strong>${pts} loyalty points</strong> to ${toEmail}.</p>
    <p><a href="/account/loyalty">View your points balance</a></p>`,
    { type: "loyalty-gift-sent", fromUserId: senderId, toUserId: recipientUser.id },
  );

  res.json({ success: true });
});

function getTiers(config: NonNullable<Awaited<ReturnType<typeof getLoyaltyConfig>>>) {
  return [
    { name: "BRONZE", threshold: config.bronzeThreshold },
    { name: "SILVER", threshold: config.silverThreshold },
    { name: "GOLD", threshold: config.goldThreshold },
    { name: "PLATINUM", threshold: config.platinumThreshold },
  ];
}

function getNextTier(currentTier: string, config: NonNullable<Awaited<ReturnType<typeof getLoyaltyConfig>>>) {
  const tiers = getTiers(config);
  const idx = tiers.findIndex((t) => t.name === currentTier);
  return idx < tiers.length - 1 ? tiers[idx + 1] : null;
}

function getCurrentTierThreshold(currentTier: string, config: NonNullable<Awaited<ReturnType<typeof getLoyaltyConfig>>>) {
  const tiers = getTiers(config);
  const idx = tiers.findIndex((t) => t.name === currentTier);
  return idx >= 0 ? tiers[idx].threshold : 0;
}

export default router;
