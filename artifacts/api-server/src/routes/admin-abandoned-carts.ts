import { Router } from "express";
import { db } from "@workspace/db";
import {
  abandonedCarts,
  abandonedCartEmails,
  abandonedCartSettings,
} from "@workspace/db/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { processAbandonedCarts } from "../services/abandoned-cart-service";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageOrders")];
const settingsGuard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/abandoned-carts/stats", ...guard, async (_req, res) => {
  const [total] = await db.select({ c: count() }).from(abandonedCarts);
  const [recovered] = await db.select({ c: count() }).from(abandonedCarts)
    .where(eq(abandonedCarts.status, "RECOVERED"));
  const [active] = await db.select({ c: count() }).from(abandonedCarts)
    .where(eq(abandonedCarts.status, "ACTIVE"));
  const [revenueRow] = await db.select({
    total: sql<string>`COALESCE(SUM(${abandonedCarts.cartTotal}), 0)`,
  }).from(abandonedCarts).where(eq(abandonedCarts.status, "RECOVERED"));

  const totalCount = total?.c ?? 0;
  const recoveredCount = recovered?.c ?? 0;
  const rate = totalCount > 0 ? ((recoveredCount / totalCount) * 100).toFixed(1) : "0.0";

  res.json({
    total: totalCount,
    active: active?.c ?? 0,
    recovered: recoveredCount,
    recoveryRate: rate,
    recoveredRevenue: revenueRow?.total ?? "0.00",
  });
});

router.get("/admin/abandoned-carts", ...guard, async (req, res) => {
  const { status, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const conditions = status && status !== "ALL"
    ? eq(abandonedCarts.status, sql`${String(status)}`)
    : undefined;

  const rows = await db.select().from(abandonedCarts)
    .where(conditions)
    .orderBy(desc(abandonedCarts.createdAt))
    .limit(limit).offset(offset);

  const [totalRow] = conditions
    ? await db.select({ c: count() }).from(abandonedCarts).where(conditions)
    : await db.select({ c: count() }).from(abandonedCarts);

  res.json({ carts: rows, total: totalRow?.c ?? 0, page, limit });
});

router.get("/admin/abandoned-carts/:id/emails", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  const emails = await db.select().from(abandonedCartEmails)
    .where(eq(abandonedCartEmails.abandonedCartId, id))
    .orderBy(desc(abandonedCartEmails.sentAt));
  res.json({ emails });
});

router.post("/admin/abandoned-carts/process", ...guard, async (_req, res) => {
  try {
    const result = await processAbandonedCarts();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/admin/abandoned-carts/:id/send-now", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  const [cart] = await db.select().from(abandonedCarts)
    .where(and(eq(abandonedCarts.id, id), eq(abandonedCarts.status, "ACTIVE")));
  if (!cart) { res.status(404).json({ error: "Cart not found or not active" }); return; }

  await db.update(abandonedCarts).set({
    lastEmailAt: new Date(0),
    updatedAt: new Date(),
  }).where(eq(abandonedCarts.id, id));

  const result = await processAbandonedCarts();
  res.json({ triggered: true, ...result });
});

router.get("/admin/abandoned-cart-settings", ...settingsGuard, async (_req, res) => {
  let [settings] = await db.select().from(abandonedCartSettings);
  if (!settings) {
    [settings] = await db.insert(abandonedCartSettings).values({}).returning();
  }
  res.json({ settings });
});

router.put("/admin/abandoned-cart-settings", ...settingsGuard, async (req, res) => {
  const { enabled, minCartValue, email1DelayMinutes, email2DelayMinutes,
    email3DelayMinutes, discountPercent, expirationDays } = req.body;

  const [existing] = await db.select().from(abandonedCartSettings);
  const values = {
    enabled: !!enabled,
    minCartValue: String(minCartValue || "5.00"),
    email1DelayMinutes: parseInt(email1DelayMinutes) || 60,
    email2DelayMinutes: parseInt(email2DelayMinutes) || 1440,
    email3DelayMinutes: parseInt(email3DelayMinutes) || 4320,
    discountPercent: parseInt(discountPercent) || 10,
    expirationDays: parseInt(expirationDays) || 7,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(abandonedCartSettings).set(values)
      .where(eq(abandonedCartSettings.id, existing.id));
  } else {
    await db.insert(abandonedCartSettings).values(values);
  }
  res.json({ success: true });
});

export default router;
