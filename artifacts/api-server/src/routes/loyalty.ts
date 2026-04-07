import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { loyaltyAccounts, loyaltyTransactions, loyaltySettings } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import {
  getLoyaltyConfig,
  getOrCreateAccount,
  pointsToDiscount,
} from "../services/loyalty-service";

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
  if (!config?.enabled) { res.json({ transactions: [] }); return; }

  const account = await getOrCreateAccount(req.user!.userId);
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const offset = (page - 1) * limit;

  const txs = await db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.accountId, account.id))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ transactions: txs });
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
