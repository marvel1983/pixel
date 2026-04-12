import { Router } from "express";
import { eq, desc, count, sql, asc, lte, gte, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  loyaltyAccounts,
  loyaltyTransactions,
  loyaltySettings,
  loyaltyEvents,
  users,
} from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { addPoints, getLoyaltyConfig, processExpiredPoints, sendExpiryWarningEmails } from "../services/loyalty-service";
import { paramString } from "../lib/route-params";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageSettings")] as const;
const loyaltyGuard = [requireAuth, requireAdmin, requirePermission("manageLoyalty")] as const;

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
    "pointsExpiryDays", "birthdayBonus", "referralBonus",
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
  const userId = Number(paramString(req.params, "id"));
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
  const userId = Number(paramString(req.params, "id"));
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

// ──── Loyalty Events (double-points) ─────────────────────────────────────────

router.get("/admin/loyalty/events", ...loyaltyGuard, async (_req, res) => {
  const events = await db.select().from(loyaltyEvents).orderBy(desc(loyaltyEvents.createdAt));
  res.json({ events });
});

router.post("/admin/loyalty/events", ...loyaltyGuard, async (req, res) => {
  const { name, multiplier, startsAt, endsAt } = req.body;
  if (!name || !startsAt || !endsAt) {
    res.status(400).json({ error: "name, startsAt, endsAt are required" });
    return;
  }
  const [event] = await db
    .insert(loyaltyEvents)
    .values({
      name,
      multiplier: String(multiplier ?? "2"),
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
    })
    .returning();
  res.status(201).json({ event });
});

router.put("/admin/loyalty/events/:id", ...loyaltyGuard, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, multiplier, startsAt, endsAt, active } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (multiplier !== undefined) update.multiplier = String(multiplier);
  if (startsAt !== undefined) update.startsAt = new Date(startsAt);
  if (endsAt !== undefined) update.endsAt = new Date(endsAt);
  if (active !== undefined) update.active = Boolean(active);
  const [updated] = await db
    .update(loyaltyEvents)
    .set(update)
    .where(eq(loyaltyEvents.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Event not found" }); return; }
  res.json({ event: updated });
});

router.delete("/admin/loyalty/events/:id", ...loyaltyGuard, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(loyaltyEvents).where(eq(loyaltyEvents.id, id));
  res.json({ success: true });
});

router.patch("/admin/loyalty/events/:id/toggle", ...loyaltyGuard, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [current] = await db.select({ active: loyaltyEvents.active }).from(loyaltyEvents).where(eq(loyaltyEvents.id, id)).limit(1);
  if (!current) { res.status(404).json({ error: "Event not found" }); return; }
  const [updated] = await db
    .update(loyaltyEvents)
    .set({ active: !current.active })
    .where(eq(loyaltyEvents.id, id))
    .returning();
  res.json({ event: updated });
});

// ──── Leaderboard & Bulk Ops ──────────────────────────────────────────────────

router.get("/admin/loyalty/leaderboard", ...loyaltyGuard, async (_req, res) => {
  const rows = await db
    .select({
      accountId: loyaltyAccounts.id,
      userId: loyaltyAccounts.userId,
      pointsBalance: loyaltyAccounts.pointsBalance,
      lifetimePoints: loyaltyAccounts.lifetimePoints,
      tier: loyaltyAccounts.tier,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(loyaltyAccounts)
    .innerJoin(users, eq(loyaltyAccounts.userId, users.id))
    .orderBy(desc(loyaltyAccounts.lifetimePoints))
    .limit(50);
  res.json({ leaderboard: rows });
});

router.get("/admin/loyalty/expiry-report", ...loyaltyGuard, async (_req, res) => {
  const in30Days = new Date(Date.now() + 30 * 86_400_000);
  const rows = await db
    .select({
      txId: loyaltyTransactions.id,
      accountId: loyaltyTransactions.accountId,
      points: loyaltyTransactions.points,
      expiresAt: loyaltyTransactions.expiresAt,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(loyaltyTransactions)
    .innerJoin(loyaltyAccounts, eq(loyaltyTransactions.accountId, loyaltyAccounts.id))
    .innerJoin(users, eq(loyaltyAccounts.userId, users.id))
    .where(
      and(
        gte(loyaltyTransactions.expiresAt, new Date()),
        lte(loyaltyTransactions.expiresAt, in30Days),
        gte(loyaltyTransactions.points, 1),
      ),
    )
    .orderBy(asc(loyaltyTransactions.expiresAt));
  res.json({ expiryReport: rows });
});

router.post("/admin/loyalty/bulk-adjust", ...loyaltyGuard, async (req, res) => {
  const { userIds, points, description, type } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ error: "userIds array required" });
    return;
  }
  const pts = parseInt(points);
  if (!pts || isNaN(pts)) { res.status(400).json({ error: "points required" }); return; }
  if (!description) { res.status(400).json({ error: "description required" }); return; }
  const txType = (type === "ADMIN" || type === "ADJUST") ? type : "ADJUST";

  const results: { userId: number; success: boolean; error?: string }[] = [];
  for (const rawId of userIds) {
    const userId = Number(rawId);
    if (!Number.isInteger(userId)) {
      results.push({ userId, success: false, error: "Invalid ID" });
      continue;
    }
    try {
      let [account] = await db
        .select()
        .from(loyaltyAccounts)
        .where(eq(loyaltyAccounts.userId, userId))
        .limit(1);
      if (!account) {
        [account] = await db.insert(loyaltyAccounts).values({ userId }).returning();
      }
      if (pts < 0 && account.pointsBalance + pts < 0) {
        results.push({ userId, success: false, error: "Would result in negative balance" });
        continue;
      }
      await addPoints(account.id, pts, txType, description);
      results.push({ userId, success: true });
    } catch (err) {
      results.push({ userId, success: false, error: String(err) });
    }
  }
  res.json({ results });
});

router.post("/admin/loyalty/trigger-expiry-warnings", ...loyaltyGuard, async (_req, res) => {
  await sendExpiryWarningEmails();
  res.json({ success: true });
});

router.post("/admin/loyalty/bulk-expire", ...loyaltyGuard, async (_req, res) => {
  await processExpiredPoints();
  res.json({ success: true });
});

export default router;
