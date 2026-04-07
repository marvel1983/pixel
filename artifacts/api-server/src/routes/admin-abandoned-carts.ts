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
import { processAbandonedCarts, sendCartEmailNow } from "../services/abandoned-cart-service";

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    res.status(500).json({ error: message });
  }
});

router.post("/admin/abandoned-carts/:id/send-now", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const sent = await sendCartEmailNow(id);
    if (!sent) {
      res.status(404).json({ error: "Cart not found, not active, or all emails already sent" });
      return;
    }
    res.json({ triggered: true, sent: 1 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    res.status(500).json({ error: message });
  }
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
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const values = {
    enabled: !!enabled,
    minCartValue: String(Math.max(0, parseFloat(minCartValue) || 5).toFixed(2)),
    email1DelayMinutes: clamp(parseInt(email1DelayMinutes) || 60, 1, 10080),
    email2DelayMinutes: clamp(parseInt(email2DelayMinutes) || 1440, 1, 10080),
    email3DelayMinutes: clamp(parseInt(email3DelayMinutes) || 4320, 1, 20160),
    discountPercent: clamp(parseInt(discountPercent) || 10, 1, 50),
    expirationDays: clamp(parseInt(expirationDays) || 7, 1, 90),
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
