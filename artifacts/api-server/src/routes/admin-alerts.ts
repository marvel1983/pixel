import { Router } from "express";
import { db } from "@workspace/db";
import { productAlerts, alertNotifications, products, productVariants } from "@workspace/db/schema";
import { eq, desc, sql, count, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageOrders")];

router.get("/admin/alerts/stats", ...guard, async (_req, res) => {
  const [totalRow] = await db.select({ c: count() }).from(productAlerts);
  const [activeRow] = await db.select({ c: count() }).from(productAlerts)
    .where(eq(productAlerts.isActive, true));
  const [priceDropRow] = await db.select({ c: count() }).from(productAlerts)
    .where(and(eq(productAlerts.alertType, "PRICE_DROP"), eq(productAlerts.isActive, true)));
  const [bisRow] = await db.select({ c: count() }).from(productAlerts)
    .where(and(eq(productAlerts.alertType, "BACK_IN_STOCK"), eq(productAlerts.isActive, true)));
  const [notifiedRow] = await db.select({ c: count() }).from(alertNotifications);

  res.json({
    total: totalRow?.c ?? 0,
    active: activeRow?.c ?? 0,
    priceDrop: priceDropRow?.c ?? 0,
    backInStock: bisRow?.c ?? 0,
    notificationsSent: notifiedRow?.c ?? 0,
  });
});

router.get("/admin/alerts", ...guard, async (req, res) => {
  const { type, active, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (type === "PRICE_DROP" || type === "BACK_IN_STOCK") {
    conditions.push(eq(productAlerts.alertType, type));
  }
  if (active === "true") conditions.push(eq(productAlerts.isActive, true));
  if (active === "false") conditions.push(eq(productAlerts.isActive, false));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    alert: productAlerts,
    productName: products.name,
    productSlug: products.slug,
  })
    .from(productAlerts)
    .innerJoin(products, eq(products.id, productAlerts.productId))
    .where(where)
    .orderBy(desc(productAlerts.createdAt))
    .limit(limit).offset(offset);

  const [totalRow] = where
    ? await db.select({ c: count() }).from(productAlerts).where(where)
    : await db.select({ c: count() }).from(productAlerts);

  res.json({ alerts: rows, total: totalRow?.c ?? 0, page, limit });
});

router.get("/admin/alerts/notifications", ...guard, async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit as string) || 25);
  const rows = await db.select({
    notification: alertNotifications,
    email: productAlerts.email,
    alertType: productAlerts.alertType,
    productName: products.name,
  })
    .from(alertNotifications)
    .innerJoin(productAlerts, eq(productAlerts.id, alertNotifications.alertId))
    .innerJoin(products, eq(products.id, productAlerts.productId))
    .orderBy(desc(alertNotifications.emailSentAt))
    .limit(limit);

  res.json({ notifications: rows });
});

router.delete("/admin/alerts/:id", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  await db.delete(productAlerts).where(eq(productAlerts.id, id));
  res.json({ success: true });
});

router.get("/admin/alerts/product-counts", ...guard, async (_req, res) => {
  const rows = await db.select({
    productId: productAlerts.productId,
    count: count(),
  })
    .from(productAlerts)
    .where(eq(productAlerts.isActive, true))
    .groupBy(productAlerts.productId);

  const counts: Record<number, number> = {};
  for (const r of rows) counts[r.productId] = r.count;
  res.json({ counts });
});

export default router;
