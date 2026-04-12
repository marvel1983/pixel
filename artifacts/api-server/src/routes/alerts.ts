import { Router } from "express";
import { db } from "@workspace/db";
import { productAlerts, products, productVariants } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { z } from "zod";
import { verifyUnsubscribe } from "../services/alert-service";
import { paramString } from "../lib/route-params";

const router = Router();

const subscribeSchema = z.object({
  email: z.string().email(),
  productId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().optional(),
  alertType: z.enum(["PRICE_DROP", "BACK_IN_STOCK"]),
  targetPriceUsd: z.coerce.number().positive().optional(),
});

router.post("/alerts/subscribe", optionalAuth, async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { email, productId, variantId, alertType, targetPriceUsd } = parsed.data;
  const userId = req.user?.userId;

  const existing = await db.select({ id: productAlerts.id }).from(productAlerts)
    .where(and(
      eq(productAlerts.email, email),
      eq(productAlerts.productId, productId),
      eq(productAlerts.alertType, alertType),
      eq(productAlerts.isActive, true),
    )).limit(1);

  if (existing.length > 0) {
    res.json({ success: true, message: "Already subscribed" });
    return;
  }

  await db.insert(productAlerts).values({
    email,
    userId: userId ?? null,
    productId,
    variantId: variantId ?? null,
    alertType,
    targetPriceUsd: targetPriceUsd?.toFixed(2) ?? null,
  });

  res.json({ success: true, message: "Alert created" });
});

router.get("/alerts/product/:productId/counts", async (req, res) => {
  const productId = parseInt(paramString(req.params, "productId"));
  const alerts = await db.select({ type: productAlerts.alertType, id: productAlerts.id })
    .from(productAlerts)
    .where(and(eq(productAlerts.productId, productId), eq(productAlerts.isActive, true)));

  const priceDrop = alerts.filter((a) => a.type === "PRICE_DROP").length;
  const backInStock = alerts.filter((a) => a.type === "BACK_IN_STOCK").length;
  res.json({ priceDrop, backInStock, total: priceDrop + backInStock });
});

router.get("/account/alerts", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db.select({
    alert: productAlerts,
    productName: products.name,
    productSlug: products.slug,
    productImage: products.imageUrl,
  })
    .from(productAlerts)
    .innerJoin(products, eq(products.id, productAlerts.productId))
    .where(eq(productAlerts.userId, userId))
    .orderBy(desc(productAlerts.createdAt));

  res.json({ alerts: rows });
});

router.delete("/account/alerts/:id", requireAuth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  const userId = req.user!.userId;

  const [alert] = await db.select().from(productAlerts)
    .where(and(eq(productAlerts.id, id), eq(productAlerts.userId, userId)));

  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }

  await db.update(productAlerts).set({ isActive: false })
    .where(eq(productAlerts.id, id));

  res.json({ success: true });
});

router.get("/alerts/unsubscribe/:token", async (req, res) => {
  const alertId = verifyUnsubscribe(paramString(req.params, "token"));
  if (alertId === null) {
    res.status(400).send("<html><body style='text-align:center;padding:60px;font-family:sans-serif'><h2>Invalid Link</h2><p>This unsubscribe link is invalid or has expired.</p></body></html>");
    return;
  }
  await db.update(productAlerts).set({ isActive: false })
    .where(eq(productAlerts.id, alertId));
  res.send("<html><body style='text-align:center;padding:60px;font-family:sans-serif'><h2>Unsubscribed</h2><p>You will no longer receive this alert.</p></body></html>");
});

export default router;
