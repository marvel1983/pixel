import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, metenziProductMappings, productVariants } from "@workspace/db/schema";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createOrder as metenziCreateOrder } from "../lib/metenzi-endpoints";
import { logger } from "../lib/logger";
import { awardOrderPoints } from "./loyalty-service";
import { sendKeyDeliveryEmail } from "../lib/email";

/**
 * Runs on a cron schedule. Finds BACKORDERED / PARTIALLY_DELIVERED orders
 * and tries to fulfill pending items if Metenzi stock has arrived.
 *
 * For each pending order item (delivered keys < ordered quantity):
 *  - Check current stockCount in productVariants (refreshed by the 30-min product sync)
 *  - If stock > 0, place a Metenzi order for min(pending, stock)
 *  - Append the new Metenzi order ID to orders.externalOrderId (comma-separated)
 *  - The keys.delivered webhook will then call handleWebhookEvent → handleOrderFulfilled
 *    which sets PARTIALLY_DELIVERED or COMPLETED based on total delivered vs total expected
 */
export async function fulfillPendingBackorders(): Promise<void> {
  const config = await getMetenziConfig();
  if (!config) return;

  // Find orders awaiting backorder fulfillment
  const pendingOrders = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, externalOrderId: orders.externalOrderId, userId: orders.userId, totalUsd: orders.totalUsd, guestEmail: orders.guestEmail })
    .from(orders)
    .where(inArray(orders.status, ["BACKORDERED", "PARTIALLY_DELIVERED"]));

  if (pendingOrders.length === 0) return;
  logger.info({ count: pendingOrders.length }, "Backorder poller: checking pending orders");

  for (const order of pendingOrders) {
    try {
      await processOrderBackorder(config, order);
    } catch (err) {
      logger.error({ err, orderId: order.id }, "Backorder poller: error processing order (non-fatal, will retry next cycle)");
    }
  }
}

async function processOrderBackorder(
  config: Awaited<ReturnType<typeof getMetenziConfig>>,
  order: { id: number; orderNumber: string; externalOrderId: string | null; userId: number | null; totalUsd: string; guestEmail: string | null },
): Promise<void> {
  // Get all order items with their delivered key count and current stock
  const itemRows = await db
    .select({
      id: orderItems.id,
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      productId: productVariants.productId,
      stockCount: productVariants.stockCount,
    })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(orderItems.orderId, order.id));

  if (itemRows.length === 0) return;

  // Count delivered keys per order item
  const deliveredCounts = await db
    .select({ orderItemId: licenseKeys.orderItemId, count: sql<number>`COUNT(*)` })
    .from(licenseKeys)
    .where(inArray(licenseKeys.orderItemId, itemRows.map((i) => i.id)))
    .groupBy(licenseKeys.orderItemId);
  const deliveredMap = new Map(deliveredCounts.map((r) => [r.orderItemId, Number(r.count)]));

  // Find items still pending (delivered < ordered)
  const pendingItems = itemRows.filter((item) => (deliveredMap.get(item.id) ?? 0) < item.quantity);
  if (pendingItems.length === 0) {
    // All keys delivered — mark COMPLETED
    await db.update(orders).set({ status: "COMPLETED", updatedAt: new Date() }).where(eq(orders.id, order.id));
    logger.info({ orderId: order.id }, "Backorder poller: all keys delivered, marked COMPLETED");
    return;
  }

  // Resolve Metenzi product IDs for pending items
  const productIds = [...new Set(pendingItems.map((i) => i.productId))];
  const mappings = await db
    .select({ pixelProductId: metenziProductMappings.pixelProductId, metenziProductId: metenziProductMappings.metenziProductId })
    .from(metenziProductMappings)
    .where(inArray(metenziProductMappings.pixelProductId, productIds));
  const mappingByProductId = new Map(mappings.map((m) => [m.pixelProductId!, m.metenziProductId]));

  // Build Metenzi order items for pending products that now have stock
  const metenziItems: { productId: string; quantity: number }[] = [];
  for (const item of pendingItems) {
    const metenziId = mappingByProductId.get(item.productId);
    if (!metenziId) continue;
    const delivered = deliveredMap.get(item.id) ?? 0;
    const pending = item.quantity - delivered;
    const available = item.stockCount ?? 0;
    const orderNow = Math.min(pending, available);
    if (orderNow <= 0) continue;
    metenziItems.push({ productId: metenziId, quantity: orderNow });
  }

  if (metenziItems.length === 0) {
    logger.info({ orderId: order.id }, "Backorder poller: still no stock available, skipping");
    return;
  }

  // Place Metenzi order for available portion only (Metenzi rejects qty > stock)
  const metenziOrder = await metenziCreateOrder(config!, metenziItems);

  // Append new Metenzi order ID (comma-separated) so findOrderByMetenziId LIKE query matches it
  const newExternalId = order.externalOrderId
    ? `${order.externalOrderId},${metenziOrder.id}`
    : metenziOrder.id;
  await db.update(orders).set({ externalOrderId: newExternalId, status: "PROCESSING", updatedAt: new Date() }).where(eq(orders.id, order.id));

  logger.info({ orderId: order.id, metenziOrderId: metenziOrder.id, itemCount: metenziItems.length }, "Backorder poller: Metenzi follow-up order placed");

  // If Metenzi already returned keys (immediate delivery), process them now
  if (metenziOrder.status === "paid" && (metenziOrder.keys?.length ?? 0) > 0) {
    const { handleWebhookEvent } = await import("./webhook-handlers");
    await handleWebhookEvent("order.fulfilled", { id: metenziOrder.id, keys: metenziOrder.keys });
  }
}
