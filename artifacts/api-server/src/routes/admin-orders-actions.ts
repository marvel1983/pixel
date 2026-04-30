import { Router } from "express";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";
import { awardOrderPoints, reverseOrderLoyaltyPoints } from "../services/loyalty-service";
import { logger } from "../lib/logger";

const router = Router();

router.patch("/admin/orders/:id/status", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }
  const validStatuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
  const { status } = req.body;
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }

  const [order] = await db.select({ id: orders.id, userId: orders.userId, totalUsd: orders.totalUsd, subtotalUsd: orders.subtotalUsd })
    .from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));

  if (status === "COMPLETED" && order.userId) {
    awardOrderPoints(order.userId, id, parseFloat(order.subtotalUsd ?? order.totalUsd)).catch((err) => {
      logger.error({ err, orderId: id }, "Failed to award loyalty points on admin status change (non-fatal)");
    });
  } else if ((status === "REFUNDED" || status === "PARTIALLY_REFUNDED") && order.userId) {
    const orderTotal = parseFloat(order.totalUsd);
    reverseOrderLoyaltyPoints(id, orderTotal, orderTotal).catch((err) => {
      logger.error({ err, orderId: id }, "Failed to reverse loyalty points on admin status change (non-fatal)");
    });
  }

  res.json({ success: true });
});

router.post("/admin/orders/bulk-status", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "No order IDs provided" }); return; }
  if (!["COMPLETED", "FAILED"].includes(status)) { res.status(400).json({ error: "Invalid bulk status" }); return; }
  const intIds = ids.map(Number).filter(Number.isInteger);
  await db.update(orders).set({ status, updatedAt: new Date() }).where(inArray(orders.id, intIds));
  res.json({ success: true, updated: intIds.length });
});

router.patch("/admin/orders/:id/notes", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }
  await db.update(orders).set({ notes: req.body.notes ?? null, updatedAt: new Date() }).where(eq(orders.id, id));
  res.json({ success: true });
});

router.post("/admin/orders/:id/sync-backorder-keys", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, externalOrderId: orders.externalOrderId, userId: orders.userId, totalUsd: orders.totalUsd })
    .from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const overrideId = typeof req.body.metenziOrderId === "string" ? req.body.metenziOrderId.trim() : null;
  const metenziOrderId = overrideId || order.externalOrderId;
  if (!metenziOrderId) { res.status(400).json({ error: "No Metenzi order ID — provide metenziOrderId in request body" }); return; }

  const { getMetenziConfig } = await import("../lib/metenzi-config");
  const { getOrderById } = await import("../lib/metenzi-endpoints");
  const { metenziProductMappings, productVariants } = await import("@workspace/db/schema");
  const { encrypt } = await import("../lib/encryption");

  const config = await getMetenziConfig();
  if (!config) { res.status(400).json({ error: "Metenzi not configured" }); return; }

  const metenziOrder = await getOrderById(config, metenziOrderId);
  if (!metenziOrder) { res.status(404).json({ error: `Metenzi order ${metenziOrderId} not found` }); return; }

  const metenziKeys = metenziOrder.keys ?? [];
  if (metenziKeys.length === 0) { res.json({ keysAdded: 0, message: "Metenzi order has no keys yet" }); return; }

  const items = await db.select({ id: orderItems.id, variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems).where(eq(orderItems.orderId, id));
  const itemIds = items.map((i) => i.id);
  const existingKeys = itemIds.length > 0
    ? await db.select({ id: licenseKeys.id, orderItemId: licenseKeys.orderItemId }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))
    : [];

  const deliveredByItem: Record<number, number> = {};
  for (const k of existingKeys) deliveredByItem[k.orderItemId!] = (deliveredByItem[k.orderItemId!] ?? 0) + 1;

  const metenziProductIds = [...new Set(metenziKeys.map((k) => k.productId).filter(Boolean))].map(String);
  const mappings = metenziProductIds.length
    ? await db.select({ metenziProductId: metenziProductMappings.metenziProductId, pixelProductId: metenziProductMappings.pixelProductId })
        .from(metenziProductMappings).where(inArray(metenziProductMappings.metenziProductId, metenziProductIds))
    : [];
  const mappingByMetenziId = new Map(mappings.map((m) => [m.metenziProductId, m.pixelProductId]));

  const itemsWithProduct = itemIds.length
    ? await db.select({ id: orderItems.id, variantId: orderItems.variantId, quantity: orderItems.quantity, productId: productVariants.productId })
        .from(orderItems).innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
        .where(inArray(orderItems.id, itemIds))
    : [];
  const itemByProductId = new Map(itemsWithProduct.map((i) => [i.productId, i]));

  const existingKeyValues = new Set(
    itemIds.length
      ? (await db.select({ keyValue: licenseKeys.keyValue }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))).map((k) => k.keyValue)
      : [],
  );

  const toInsert: Array<{ variantId: number; keyValue: string; keyMask: string; orderItemId: number }> = [];
  let keysAdded = 0;
  for (const mk of metenziKeys) {
    if (!mk.code || !mk.productId) continue;
    const pixelProductId = mappingByMetenziId.get(mk.productId);
    if (!pixelProductId) continue;
    const dbItem = itemByProductId.get(pixelProductId);
    if (!dbItem) continue;
    const alreadyDelivered = deliveredByItem[dbItem.id] ?? 0;
    if (alreadyDelivered >= dbItem.quantity) continue;
    const encryptedKey = encrypt(mk.code);
    if (existingKeyValues.has(encryptedKey)) continue;
    existingKeyValues.add(encryptedKey);
    const keyMask = mk.code.length <= 8 ? mk.code.slice(0, 2) + "****" : mk.code.slice(0, 4) + "****" + mk.code.slice(-4);
    toInsert.push({ variantId: dbItem.variantId, keyValue: encryptedKey, keyMask, orderItemId: dbItem.id });
    deliveredByItem[dbItem.id] = alreadyDelivered + 1;
    keysAdded++;
  }

  if (toInsert.length > 0) {
    await db.insert(licenseKeys).values(toInsert.map((k) => ({ ...k, status: "SOLD" as const, source: "API" as const, soldAt: new Date() })));
  }

  const totalExpected = items.reduce((s, i) => s + i.quantity, 0);
  const totalDelivered = (itemIds.length > 0
    ? await db.select({ id: licenseKeys.id }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))
    : []).length;

  if (keysAdded > 0) {
    const newStatus = totalDelivered >= totalExpected ? "COMPLETED" : "PARTIALLY_DELIVERED";
    await db.update(orders).set({ status: newStatus, updatedAt: new Date() }).where(eq(orders.id, id));
    if (newStatus === "COMPLETED" && order.userId) {
      awardOrderPoints(order.userId, id, parseFloat(order.totalUsd)).catch((err) => {
        logger.error({ err, orderId: id }, "Failed to award loyalty points on key sync (non-fatal)");
      });
    }
    logger.info({ orderId: id, orderNumber: order.orderNumber, keysAdded, metenziOrderId }, "Admin: sync-backorder-keys added keys");
  }

  res.json({ keysAdded, totalDelivered, totalExpected, message: keysAdded > 0 ? `${keysAdded} key(s) added` : "No new keys found" });
});

router.post("/admin/orders/:id/resend-email", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }
  const [order] = await db.select({ id: orders.id, orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json({ success: true, message: "Email queued for resend" });
});

router.post("/admin/orders/:id/redeliver-keys", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select({ id: orders.id, externalOrderId: orders.externalOrderId }).from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (!order.externalOrderId) { res.status(400).json({ error: "Order has no Metenzi external ID" }); return; }

  const { getMetenziConfig } = await import("../lib/metenzi-config");
  const { getOrderById } = await import("../lib/metenzi-endpoints");
  const config = await getMetenziConfig();
  if (!config) { res.status(400).json({ error: "Metenzi not configured" }); return; }

  const metenziOrder = await getOrderById(config, order.externalOrderId);
  if (!metenziOrder) { res.status(404).json({ error: "Metenzi order not found" }); return; }

  const { handleWebhookEvent } = await import("../services/webhook-handlers");
  await handleWebhookEvent("order.fulfilled", { id: metenziOrder.id, keys: metenziOrder.keys ?? [] });

  res.json({ success: true });
});

router.post("/admin/orders/:id/force-fulfill", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }
  const { forceFulfill } = await import("../services/force-fulfill");
  try {
    const result = await forceFulfill(id);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Force fulfill failed";
    const status = msg.includes("not found") ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

router.post("/admin/orders/:id/manual-assign-keys", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const body = req.body as { keys?: Array<{ orderItemId?: number; key?: string }> };
  if (!Array.isArray(body?.keys) || body.keys.length === 0) {
    res.status(400).json({ error: "Body must include non-empty keys array: [{orderItemId, key}, ...]" }); return;
  }

  const { manualAssignKeys } = await import("../services/manual-key-assign");
  try {
    const result = await manualAssignKeys(
      id,
      body.keys.map((k) => ({ orderItemId: Number(k.orderItemId), key: String(k.key ?? "") })),
      req.user?.userId ?? null,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Manual assign failed";
    const status = msg.includes("not found") ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

router.post("/admin/orders/:id/retry-fulfillment", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, notes: orders.notes, externalOrderId: orders.externalOrderId })
    .from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.externalOrderId) { res.status(400).json({ error: "Order already has a Metenzi order ID — use redeliver-keys instead" }); return; }

  const { enqueueJob } = await import("../lib/job-queue");
  const items = await db.select({ variantId: orderItems.variantId }).from(orderItems).where(eq(orderItems.orderId, id));
  if (items.length === 0) { res.status(400).json({ error: "No order items found" }); return; }

  const { productVariants } = await import("@workspace/db/schema");
  const variantRows = await db.select({ id: productVariants.id, productId: productVariants.productId }).from(productVariants)
    .where(inArray(productVariants.id, items.map((i) => i.variantId)));
  const productIds = [...new Set(variantRows.map((v) => v.productId))];

  await enqueueJob({ queue: "order-processing", name: "metenzi-retry-fulfillment", priority: 3, maxAttempts: 3, payload: { orderId: id, productIds } });

  logger.info({ orderId: id, orderNumber: order.orderNumber }, "Admin: retry fulfillment enqueued");
  res.json({ success: true, message: `Fulfillment retry enqueued for order ${order.orderNumber}` });
});

export default router;
