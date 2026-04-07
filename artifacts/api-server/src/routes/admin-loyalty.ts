import { Router } from "express";
import { eq, desc, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  loyaltyAccounts,
  loyaltyTransactions,
  loyaltySettings,
  users,
} from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { addPoints, getLoyaltyConfig } from "../services/loyalty-service";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageSettings")] as const;

router.get("/admin/loyalty/settings", ...guard, async (_req, res) => {
  const config = await getLoyaltyConfig();
  if (!config) {
    const [created] = await db.insert(loyaltySettings).values({}).returning();
    res.json(created);
    return;
  }
  res.json(config);
});

router.put("/admin/loyalty/settings", ...guard, async (req, res) => {
  const fields = [
    "enabled", "pointsPerDollar", "redemptionRate", "welcomeBonus",
    "reviewBonus", "minRedeemPoints", "maxRedeemPercent",
    "bronzeThreshold", "silverThreshold", "goldThreshold", "platinumThreshold",
    "bronzeMultiplier", "silverMultiplier", "goldMultiplier", "platinumMultiplier",
    "pointsExpiryDays",
  ];

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      update[f] = req.body[f];
    }
  }

  let [config] = await db.select({ id: loyaltySettings.id }).from(loyaltySettings).limit(1);
  if (config) {
    await db.update(loyaltySettings).set(update).where(eq(loyaltySettings.id, config.id));
  } else {
    await db.insert(loyaltySettings).values(update as Record<string, unknown>);
  }
  res.json({ success: true });
});

router.get("/admin/loyalty/stats", ...guard, async (_req, res) => {
  const [stats] = await db
    .select({
      totalAccounts: count(),
      totalPoints: sql<number>`coalesce(sum(${loyaltyAccounts.pointsBalance}), 0)::int`,
      totalLifetime: sql<number>`coalesce(sum(${loyaltyAccounts.lifetimePoints}), 0)::int`,
    })
    .from(loyaltyAccounts);
  res.json(stats);
});

const custGuard = [requireAuth, requireAdmin, requirePermission("manageCustomers")] as const;

router.get("/admin/customers/:id/loyalty", ...custGuard, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [account] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.userId, userId))
    .limit(1);

  if (!account) {
    res.json({ account: null, transactions: [] });
    return;
  }

  const txs = await db
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.accountId, account.id))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(50);

  res.json({ account, transactions: txs });
});

router.post("/admin/customers/:id/loyalty/adjust", ...custGuard, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { points, note } = req.body;
  const pts = parseInt(points);
  if (!pts || isNaN(pts)) { res.status(400).json({ error: "Points required" }); return; }

  let [account] = await db
    .select()
    .from(loyaltyAccounts)
    .where(eq(loyaltyAccounts.userId, userId))
    .limit(1);

  if (!account) {
    [account] = await db.insert(loyaltyAccounts).values({ userId }).returning();
  }

  if (pts < 0 && account.pointsBalance + pts < 0) {
    res.status(400).json({ error: "Adjustment would result in negative balance" });
    return;
  }

  const type = pts > 0 ? "ADMIN_ADD" : "ADMIN_DEDUCT";
  const desc = pts > 0 ? `Admin added ${pts} points` : `Admin deducted ${Math.abs(pts)} points`;
  await addPoints(account.id, pts, type, desc, { adminNote: note || undefined });

  res.json({ success: true });
});

export default router;
