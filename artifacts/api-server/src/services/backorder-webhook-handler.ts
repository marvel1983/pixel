import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, auditLog, users, metenziProductMappings, productVariants, products } from "@workspace/db/schema";
import { encrypt } from "../lib/encryption";
import { sendKeyDeliveryEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { awardOrderPoints } from "./loyalty-service";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getOrderById } from "../lib/metenzi-endpoints";

interface MetenziKey { code: string; codeType?: string; status?: string; productId: string }
interface FulfilledData { id?: string; orderId?: string; keys?: MetenziKey[] }

async function logAudit(orderId: number | null, metenziOrderId: string, extra: Record<string, unknown>) {
  try {
    await db.insert(auditLog).values({ action: "UPDATE", entityType: "order", entityId: orderId, details: { webhookEvent: "backorder.fulfilled", metenziOrderId, ...extra } });
  } catch { /* non-fatal */ }
}

// backorder.fulfilled fires with a NEW Metenzi orderId different from our stored externalOrderId.
// Fetch the order from Metenzi to get keys + productIds, then match local BACKORDERED/PARTIALLY_DELIVERED
// orders by product and assign keys FIFO.
export async function handleBackorderFulfilled(data: FulfilledData) {
  const metenziOrderId = data.id ?? data.orderId ?? "";
  logger.info({ metenziOrderId }, "Processing backorder.fulfilled webhook");

  let keys: MetenziKey[] = data.keys ?? [];
  if (metenziOrderId) {
    try {
      const config = await getMetenziConfig();
      if (config) {
        const metenziOrder = await getOrderById(config, metenziOrderId);
        if (metenziOrder?.keys?.length) keys = metenziOrder.keys;
        logger.info({ metenziOrderId, keysFetched: keys.length }, "Fetched keys from Metenzi API for backorder.fulfilled");
      }
    } catch (err) {
      logger.error({ err, metenziOrderId }, "Failed to fetch backorder order from Metenzi API");
    }
  }

  if (keys.length === 0) {
    logger.warn({ metenziOrderId }, "backorder.fulfilled: no keys available from webhook or API");
    await logAudit(null, metenziOrderId, { error: "no_keys" });
    return;
  }

  // Group keys by Metenzi productId
  const keysByProduct = new Map<string, string[]>();
  for (const k of keys) {
    if (!k.code || !k.productId) continue;
    if (!keysByProduct.has(k.productId)) keysByProduct.set(k.productId, []);
    keysByProduct.get(k.productId)!.push(k.code);
  }

  for (const [metenziProductId, keyCodes] of keysByProduct) {
    const [mapping] = await db
      .select({ pixelProductId: metenziProductMappings.pixelProductId })
      .from(metenziProductMappings)
      .where(eq(metenziProductMappings.metenziProductId, metenziProductId))
      .limit(1);
    if (!mapping?.pixelProductId) {
      logger.warn({ metenziProductId }, "backorder.fulfilled: no Pixel mapping for product — skipping");
      continue;
    }

    // Find orders in backorder/partial states that need keys for this product (FIFO)
    const pendingItems = await db
      .select({
        orderId: orderItems.orderId, orderItemId: orderItems.id,
        quantity: orderItems.quantity, productName: orderItems.productName,
        variantName: orderItems.variantName, variantId: orderItems.variantId,
        orderNumber: orders.orderNumber, guestEmail: orders.guestEmail,
        userId: orders.userId, totalUsd: orders.totalUsd,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(and(
        inArray(orders.status, ["BACKORDERED", "PARTIALLY_DELIVERED", "PROCESSING"]),
        eq(productVariants.productId, mapping.pixelProductId),
      ))
      .orderBy(orders.id); // oldest first

    const keyQueue = [...keyCodes];
    for (const item of pendingItems) {
      if (keyQueue.length === 0) break;

      const existingKeys = await db.select({ id: licenseKeys.id }).from(licenseKeys).where(eq(licenseKeys.orderItemId, item.orderItemId));
      const needed = item.quantity - existingKeys.length;
      if (needed <= 0) continue;

      const keysToDeliver: { productName: string; variant: string; licenseKey: string; variantId: number }[] = [];
      for (let i = 0; i < needed && keyQueue.length > 0; i++) {
        const key = keyQueue.shift()!;
        const encryptedKey = encrypt(key);
        const keyMask = key.length <= 8 ? key.slice(0, 2) + "****" : key.slice(0, 4) + "****" + key.slice(-4);
        const [dupe] = await db.select({ id: licenseKeys.id }).from(licenseKeys)
          .where(and(eq(licenseKeys.keyValue, encryptedKey), eq(licenseKeys.orderItemId, item.orderItemId))).limit(1);
        if (dupe) continue;
        await db.insert(licenseKeys).values({ variantId: item.variantId, keyValue: encryptedKey, keyMask, status: "SOLD", source: "API", orderItemId: item.orderItemId, soldAt: new Date() });
        keysToDeliver.push({ productName: item.productName, variant: item.variantName, licenseKey: key, variantId: item.variantId });
      }
      if (keysToDeliver.length === 0) continue;

      // Update order status
      const allItems = await db.select({ id: orderItems.id, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, item.orderId));
      const totalExpected = allItems.reduce((s, i) => s + i.quantity, 0);
      const itemIds = allItems.map((i) => i.id);
      const deliveredCount = itemIds.length > 0
        ? (await db.select({ id: licenseKeys.id }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))).length : 0;
      const newStatus = deliveredCount >= totalExpected ? "COMPLETED" : "PARTIALLY_DELIVERED";
      await db.update(orders).set({ status: newStatus, updatedAt: new Date() }).where(eq(orders.id, item.orderId));

      logger.info({ orderId: item.orderId, orderNumber: item.orderNumber, keysDelivered: keysToDeliver.length, newStatus }, "Backorder keys assigned to order");

      if (newStatus === "COMPLETED" && item.userId) {
        awardOrderPoints(item.userId, item.orderId, parseFloat(item.totalUsd)).catch((err) =>
          logger.error({ err, orderId: item.orderId }, "Failed to award loyalty points on backorder completion (non-fatal)"),
        );
      }

      let email = item.guestEmail;
      if (!email && item.userId) {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, item.userId)).limit(1);
        email = user?.email ?? null;
      }
      if (email) {
        const backorderNote = newStatus === "PARTIALLY_DELIVERED"
          ? `${deliveredCount} of ${totalExpected} key(s) delivered. ${totalExpected - deliveredCount} key(s) still on backorder.`
          : undefined;
        const [instrRow] = await db.select({ instructions: products.activationInstructions })
          .from(productVariants).leftJoin(products, eq(products.id, productVariants.productId))
          .where(eq(productVariants.id, item.variantId)).limit(1);
        const instructions = instrRow?.instructions ?? undefined;
        sendKeyDeliveryEmail(email, { orderRef: item.orderNumber, customerName: "Customer", keys: keysToDeliver.map((k) => ({ ...k, instructions })), backorderNote })
          .catch((err) => logger.error({ err, orderId: item.orderId }, "Failed to send backorder key delivery email"));
      }

      await logAudit(item.orderId, metenziOrderId, { metenziProductId, keysDelivered: keysToDeliver.length, newStatus });
    }
  }
}
