import { Router } from "express";
import { db } from "@workspace/db";
import { orders, orderItems } from "@workspace/db/schema";
import { eq, desc, and, isNotNull, lt, inArray } from "drizzle-orm";
import { licenseKeys } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { runFulfillment } from "../services/order-pipeline";
import { parseFulfillmentPayload } from "./checkout-session";
import { logger } from "../lib/logger";

const router = Router();

// Returns PROCESSING orders that have been waiting for keys past the warn threshold.
// Used by the admin dashboard "Stuck Fulfillment" panel.
router.get("/admin/orders/stuck-fulfillment", requireAuth, requireAdmin, requirePermission("manageOrders"), async (_req, res) => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000); // 30 min

  const candidates = await db.select({
    id: orders.id, orderNumber: orders.orderNumber, guestEmail: orders.guestEmail,
    totalUsd: orders.totalUsd, externalOrderId: orders.externalOrderId,
    createdAt: orders.createdAt, stuckAlertSentAt: orders.stuckAlertSentAt,
  }).from(orders)
    .where(and(
      eq(orders.status, "PROCESSING"),
      isNotNull(orders.externalOrderId),
      lt(orders.createdAt, cutoff),
    ))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  if (candidates.length === 0) { res.json({ orders: [], count: 0 }); return; }

  // Filter to those with zero delivered keys
  const ids = candidates.map((c) => c.id);
  const itemRows = await db.select({ id: orderItems.id, orderId: orderItems.orderId })
    .from(orderItems).where(inArray(orderItems.orderId, ids));
  const itemIdsByOrder: Record<number, number[]> = {};
  for (const r of itemRows) (itemIdsByOrder[r.orderId] ??= []).push(r.id);
  const allItemIds = itemRows.map((r) => r.id);
  const keyRows = allItemIds.length
    ? await db.select({ orderItemId: licenseKeys.orderItemId }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, allItemIds))
    : [];
  const deliveredByItem: Record<number, number> = {};
  for (const r of keyRows) if (r.orderItemId != null) deliveredByItem[r.orderItemId] = (deliveredByItem[r.orderItemId] ?? 0) + 1;

  const stuck = candidates.filter((c) => {
    const itemIds = itemIdsByOrder[c.id] ?? [];
    return itemIds.reduce((s, id) => s + (deliveredByItem[id] ?? 0), 0) === 0;
  });

  res.json({ orders: stuck, count: stuck.length });
});

router.get("/admin/orders/held", requireAuth, requireAdmin, requirePermission("manageOrders"), async (_req, res) => {
  const held = await db.select({
    id: orders.id, orderNumber: orders.orderNumber, guestEmail: orders.guestEmail,
    totalUsd: orders.totalUsd, riskScore: orders.riskScore, riskReasons: orders.riskReasons,
    ipAddress: orders.ipAddress, createdAt: orders.createdAt,
    paymentIntentId: orders.paymentIntentId, billingSnapshot: orders.billingSnapshot,
  }).from(orders)
    .where(eq(orders.status, "HELD"))
    .orderBy(desc(orders.createdAt));
  res.json({ orders: held });
});

router.post("/admin/orders/:id/release", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const orderId = parseInt(req.params.id as string, 10);
  if (!orderId) { res.status(400).json({ error: "Invalid order id" }); return; }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "HELD") {
    res.status(404).json({ error: "Held order not found" }); return;
  }

  type ReleaseItem = { variantId: number; productId: number; productName: string; variantName: string; priceUsd: string; quantity: number; bundleId: number | null };

  let items: ReleaseItem[] = [];
  let billing = order.billingSnapshot as {
    firstName: string; lastName: string; email: string;
    country: string; city: string; address: string; zip: string; phone?: string;
  } | null;

  const payload = parseFulfillmentPayload(order.notes);
  if (payload) {
    if (!billing) billing = payload.billing;
    items = payload.items.map((i) => ({
      variantId: i.variantId, productId: i.productId,
      productName: i.productName, variantName: i.variantName,
      priceUsd: i.priceUsd, quantity: i.quantity, bundleId: i.bundleId ?? null,
    }));
  }

  if (items.length === 0) {
    const dbItems = await db.select({
      variantId: orderItems.variantId, productName: orderItems.productName,
      variantName: orderItems.variantName, priceUsd: orderItems.priceUsd,
      quantity: orderItems.quantity, bundleId: orderItems.bundleId,
    }).from(orderItems).where(eq(orderItems.orderId, orderId));
    items = dbItems.map((i) => ({
      variantId: i.variantId, productId: 0,
      productName: i.productName, variantName: i.variantName,
      priceUsd: i.priceUsd, quantity: i.quantity, bundleId: i.bundleId ?? null,
    }));
  }

  if (!billing) { res.status(400).json({ error: "Order has no billing snapshot and no fulfillment payload" }); return; }
  if (items.length === 0) { res.status(400).json({ error: "No items found for this order" }); return; }

  try {
    await runFulfillment(orderId, order.orderNumber, order.paymentIntentId ?? "", {
      billing: { ...billing, phone: billing.phone ?? "" },
      items: items.map((i) => ({
        variantId: i.variantId, productId: i.productId,
        productName: i.productName, variantName: i.variantName,
        priceUsd: i.priceUsd, quantity: i.quantity,
        bundleId: i.bundleId ?? undefined,
      })),
      userId: order.userId ?? undefined,
    }, parseFloat(order.totalUsd));

    await db.update(orders).set({ riskHold: false, updatedAt: new Date() }).where(eq(orders.id, orderId));
    logger.info({ orderId, orderNumber: order.orderNumber }, "Held order released by admin");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, orderId }, "Failed to release held order");
    res.status(500).json({ error: "Failed to release order" });
  }
});

router.post("/admin/orders/:id/cancel-hold", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const orderId = parseInt(req.params.id as string, 10);
  if (!orderId) { res.status(400).json({ error: "Invalid order id" }); return; }

  const [order] = await db.select({ status: orders.status, orderNumber: orders.orderNumber })
    .from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "HELD") {
    res.status(404).json({ error: "Held order not found" }); return;
  }

  await db.update(orders).set({ status: "FAILED", riskHold: false, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  logger.info({ orderId, orderNumber: order.orderNumber }, "Held order cancelled by admin");
  res.json({ ok: true });
});

export default router;
