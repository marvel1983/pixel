import { eq, and, inArray, sql, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, metenziProductMappings, productVariants, users } from "@workspace/db/schema";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createOrder as metenziCreateOrder } from "../lib/metenzi-endpoints";
import { encrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { awardOrderPoints } from "./loyalty-service";
import { sendKeyDeliveryEmail } from "../lib/email";
import type { MetenziClientConfig } from "../lib/metenzi-client";

/**
 * Runs on a cron schedule. Finds BACKORDERED / PARTIALLY_DELIVERED orders
 * and tries to fulfill pending items if Metenzi stock has arrived.
 *
 * Key design: one Metenzi order per PRODUCT per cycle, not one per customer.
 * All customers waiting for the same product are batched into a single Metenzi order,
 * then keys are distributed FIFO. This keeps the Metenzi order list clean and makes
 * complaint tracking simple (each key traces to one Metenzi order).
 */

interface PendingItemRow {
  orderItemId: number;
  orderId: number;
  orderNumber: string;
  userId: number | null;
  guestEmail: string | null;
  externalOrderId: string | null;
  totalUsd: string;
  variantId: number;
  productId: number;
  variantName: string;
  productName: string;
  quantity: number;
  delivered: number;
  pendingQty: number;
  stockCount: number;
  metenziProductId: string | null;
}

export async function fulfillPendingBackorders(): Promise<void> {
  const config = await getMetenziConfig();
  if (!config) return;

  const pendingItems = await getPendingBackorderItems();
  if (pendingItems.length === 0) return;

  logger.info({ itemCount: pendingItems.length }, "Backorder poller: processing pending items");

  // Group by Metenzi product — one order per product covers all waiting customers
  const byProduct = new Map<string, { stockCount: number; items: PendingItemRow[] }>();
  for (const item of pendingItems) {
    if (!item.metenziProductId) continue;
    const existing = byProduct.get(item.metenziProductId);
    if (existing) {
      existing.items.push(item);
    } else {
      byProduct.set(item.metenziProductId, { stockCount: item.stockCount, items: [item] });
    }
  }

  if (byProduct.size === 0) {
    logger.info("Backorder poller: no Metenzi-mapped pending items");
    return;
  }

  for (const [metenziProductId, { stockCount, items }] of byProduct) {
    try {
      await fulfillProductBackorder(config, metenziProductId, stockCount, items);
    } catch (err) {
      logger.error({ err, metenziProductId }, "Backorder poller: error fulfilling product (non-fatal)");
    }
  }
}

async function getPendingBackorderItems(): Promise<PendingItemRow[]> {
  const pendingOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      externalOrderId: orders.externalOrderId,
      userId: orders.userId,
      guestEmail: orders.guestEmail,
      totalUsd: orders.totalUsd,
    })
    .from(orders)
    .where(inArray(orders.status, ["BACKORDERED", "PARTIALLY_DELIVERED"]))
    .orderBy(asc(orders.createdAt)); // FIFO

  if (pendingOrders.length === 0) return [];

  const orderIds = pendingOrders.map((o) => o.id);

  const itemRows = await db
    .select({
      orderItemId: orderItems.id,
      orderId: orderItems.orderId,
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      productId: productVariants.productId,
      stockCount: productVariants.stockCount,
    })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(inArray(orderItems.orderId, orderIds));

  if (itemRows.length === 0) return [];

  const deliveredCounts = await db
    .select({ orderItemId: licenseKeys.orderItemId, count: sql<number>`COUNT(*)` })
    .from(licenseKeys)
    .where(inArray(licenseKeys.orderItemId, itemRows.map((i) => i.orderItemId)))
    .groupBy(licenseKeys.orderItemId);
  const deliveredMap = new Map(deliveredCounts.map((r) => [r.orderItemId, Number(r.count)]));

  const productIds = [...new Set(itemRows.map((i) => i.productId))];
  const mappings = await db
    .select({ pixelProductId: metenziProductMappings.pixelProductId, metenziProductId: metenziProductMappings.metenziProductId })
    .from(metenziProductMappings)
    .where(inArray(metenziProductMappings.pixelProductId, productIds));
  const mappingMap = new Map(mappings.map((m) => [m.pixelProductId!, m.metenziProductId]));

  const orderMeta = new Map(pendingOrders.map((o) => [o.id, o]));

  const result: PendingItemRow[] = [];
  for (const item of itemRows) {
    const delivered = deliveredMap.get(item.orderItemId) ?? 0;
    const pendingQty = item.quantity - delivered;
    if (pendingQty <= 0) continue;
    const meta = orderMeta.get(item.orderId)!;
    result.push({
      orderItemId: item.orderItemId,
      orderId: item.orderId,
      orderNumber: meta.orderNumber,
      userId: meta.userId,
      guestEmail: meta.guestEmail,
      externalOrderId: meta.externalOrderId,
      totalUsd: meta.totalUsd,
      variantId: item.variantId,
      productId: item.productId,
      variantName: item.variantName,
      productName: item.productName,
      quantity: item.quantity,
      delivered,
      pendingQty,
      stockCount: item.stockCount ?? 0,
      metenziProductId: mappingMap.get(item.productId) ?? null,
    });
  }
  return result;
}

async function fulfillProductBackorder(
  config: MetenziClientConfig,
  metenziProductId: string,
  stockCount: number,
  items: PendingItemRow[],
): Promise<void> {
  const totalNeeded = items.reduce((s, i) => s + i.pendingQty, 0);
  const orderNow = Math.min(totalNeeded, stockCount);

  if (orderNow <= 0) {
    logger.info({ metenziProductId, totalNeeded, stockCount }, "Backorder: no stock, skipping");
    return;
  }

  // ONE Metenzi order for all customers waiting on this product
  const metenziOrder = await metenziCreateOrder(config, [{ productId: metenziProductId, quantity: orderNow }]);

  logger.info({
    metenziProductId,
    metenziOrderId: metenziOrder.id,
    orderNow,
    totalNeeded,
    keysReceived: metenziOrder.keys?.length ?? 0,
    customerOrderCount: new Set(items.map((i) => i.orderId)).size,
  }, "Backorder: batch Metenzi order placed");

  if (!metenziOrder.keys?.length) {
    // Keys not returned immediately — link metenzi order to all affected orders so webhook can find them
    const affectedOrderIds = [...new Set(items.map((i) => i.orderId))];
    for (const orderId of affectedOrderIds) {
      const item = items.find((i) => i.orderId === orderId)!;
      const newExtId = item.externalOrderId ? `${item.externalOrderId},${metenziOrder.id}` : metenziOrder.id;
      await db.update(orders).set({ externalOrderId: newExtId, updatedAt: new Date() }).where(eq(orders.id, orderId));
    }
    logger.warn({ metenziOrderId: metenziOrder.id }, "Backorder: no keys in response, waiting for webhook");
    return;
  }

  // Distribute keys FIFO across customer orders
  const keyQueue = [...metenziOrder.keys];

  // Group items by orderId (already in FIFO order from getPendingBackorderItems)
  const byOrder = new Map<number, PendingItemRow[]>();
  for (const item of items) {
    const arr = byOrder.get(item.orderId) ?? [];
    arr.push(item);
    byOrder.set(item.orderId, arr);
  }

  for (const [orderId, orderItemList] of byOrder) {
    if (keyQueue.length === 0) break;
    await assignKeysToOrder(orderId, orderItemList, keyQueue, metenziOrder.id);
  }
}

async function assignKeysToOrder(
  orderId: number,
  pendingItems: PendingItemRow[],
  keyQueue: Array<{ code: string; productId: string }>,
  metenziOrderId: string,
): Promise<void> {
  const deliveredKeys: { productName: string; variant: string; licenseKey: string }[] = [];

  for (const item of pendingItems) {
    if (keyQueue.length === 0) break;
    const keysToAssign = keyQueue.splice(0, Math.min(item.pendingQty, keyQueue.length));

    for (const keyItem of keysToAssign) {
      const key = keyItem.code;
      if (!key) continue;
      const encryptedKey = encrypt(key);
      const keyMask = key.length <= 8 ? key.slice(0, 2) + "****" : key.slice(0, 4) + "****" + key.slice(-4);

      const [existing] = await db
        .select({ id: licenseKeys.id })
        .from(licenseKeys)
        .where(and(eq(licenseKeys.keyValue, encryptedKey), eq(licenseKeys.orderItemId, item.orderItemId)))
        .limit(1);
      if (existing) continue;

      await db.insert(licenseKeys).values({
        variantId: item.variantId,
        keyValue: encryptedKey,
        keyMask,
        status: "SOLD",
        source: "API",
        orderItemId: item.orderItemId,
        soldAt: new Date(),
      });
      deliveredKeys.push({ productName: item.productName, variant: item.variantName, licenseKey: key });
    }
  }

  if (deliveredKeys.length === 0) return;

  // Check total delivered vs expected
  const allOrderItems = await db
    .select({ id: orderItems.id, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const totalExpected = allOrderItems.reduce((s, i) => s + i.quantity, 0);
  const deliveredRows = await db
    .select({ id: licenseKeys.id })
    .from(licenseKeys)
    .where(inArray(licenseKeys.orderItemId, allOrderItems.map((i) => i.id)));
  const totalDelivered = deliveredRows.length;
  const newStatus = totalDelivered >= totalExpected ? "COMPLETED" : "PARTIALLY_DELIVERED";

  const firstItem = pendingItems[0];
  const newExtId = firstItem.externalOrderId
    ? `${firstItem.externalOrderId},${metenziOrderId}`
    : metenziOrderId;

  await db.update(orders).set({ status: newStatus, externalOrderId: newExtId, updatedAt: new Date() }).where(eq(orders.id, orderId));

  // Send email to customer
  let email: string | null = firstItem.guestEmail;
  if (!email && firstItem.userId) {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, firstItem.userId)).limit(1);
    email = user?.email ?? null;
  }
  if (email) {
    const backorderNote = newStatus === "PARTIALLY_DELIVERED"
      ? `${totalDelivered} of ${totalExpected} key(s) delivered. The remaining ${totalExpected - totalDelivered} key(s) are on backorder and will be emailed automatically once available.`
      : undefined;
    sendKeyDeliveryEmail(email, {
      orderRef: firstItem.orderNumber,
      customerName: "Customer",
      keys: deliveredKeys,
      backorderNote,
    }).catch((err) => logger.error({ err, orderId }, "Failed to enqueue key delivery email from backorder"));
  }

  if (newStatus === "COMPLETED" && firstItem.userId) {
    try { await awardOrderPoints(firstItem.userId, orderId, parseFloat(firstItem.totalUsd)); } catch {}
  }

  logger.info({ orderId, metenziOrderId, keysDelivered: deliveredKeys.length, newStatus }, "Backorder: keys assigned to customer order");
}
