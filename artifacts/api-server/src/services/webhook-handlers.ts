import { eq, and, inArray, like } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  licenseKeys,
  auditLog,
  users,
  metenziProductMappings,
  productVariants,
} from "@workspace/db/schema";
import { encrypt } from "../lib/encryption";
import { sendKeyDeliveryEmail, enqueueEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { awardOrderPoints } from "./loyalty-service";

// Metenzi order key (at order level, NOT inside items)
interface MetenziKey {
  code: string;
  codeType?: string;
  status?: string;
  productId: string; // Metenzi product ID — matched via metenzi_product_mappings
}

// Actual Metenzi order payload (from webhook data or GET /api/public/orders/:id)
interface FulfilledData {
  id?: string;      // Metenzi order ID (in direct API responses)
  orderId?: string; // Metenzi order ID (some webhook payloads use this field)
  keys?: MetenziKey[];   // Keys at ORDER level (not per item)
  // Legacy/fallback — items with inline keys (old assumption, kept for safety)
  items?: Array<{ variantId?: string; productId?: string; quantity?: number; keys?: string[] }>;
}

interface OrderEventData {
  id?: string;
  orderId?: string;
  reason?: string;
}

interface ClaimEventData {
  claimId: string;
  orderId: string;
  reason?: string;
  resolution?: string;
  status?: string;
}

async function logAuditEvent(
  action: "CREATE" | "UPDATE",
  entityType: string,
  entityId: number | null,
  details: Record<string, unknown>,
) {
  try {
    await db.insert(auditLog).values({
      action,
      entityType,
      entityId: entityId,
      details,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log for webhook event");
  }
}

async function findOrderByMetenziId(metenziOrderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      guestEmail: orders.guestEmail,
      userId: orders.userId,
      totalUsd: orders.totalUsd,
    })
    .from(orders)
    .where(like(orders.externalOrderId, `%${metenziOrderId}%`))
    .limit(1);
  if (!order) return null;

  let email = order.guestEmail;
  if (!email && order.userId) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    email = user?.email ?? null;
  }
  return { ...order, email };
}

async function handleOrderFulfilled(data: FulfilledData) {
  const metenziOrderId = data.id ?? data.orderId ?? "";
  logger.info({ metenziOrderId, dataKeys: Object.keys(data) }, "Processing order.fulfilled webhook");

  const order = await findOrderByMetenziId(metenziOrderId);
  if (!order) {
    logger.warn({ metenziOrderId }, "No matching local order for fulfilled webhook");
    await logAuditEvent("UPDATE", "order", null, {
      webhookEvent: "order.fulfilled",
      metenziOrderId,
      error: "no matching local order",
    });
    return;
  }

  // Idempotency: check for existing keys
  const existingOrderItems = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  const orderItemIds = existingOrderItems.map((i) => i.id);
  const existingKeys = orderItemIds.length
    ? await db
        .select({ id: licenseKeys.id })
        .from(licenseKeys)
        .where(inArray(licenseKeys.orderItemId, orderItemIds))
        .limit(1)
    : [];

  if (existingKeys.length > 0) {
    logger.info({ orderId: order.id }, "order.fulfilled already processed (idempotent skip)");
    return;
  }

  const keysToDeliver: { productName: string; variant: string; licenseKey: string }[] = [];

  // Primary path: Metenzi puts keys at order level — order.keys[{ code, productId }]
  const topLevelKeys = data.keys ?? [];

  if (topLevelKeys.length > 0) {
    for (const keyItem of topLevelKeys) {
      if (!keyItem.code || !keyItem.productId) continue;

      const [mapping] = await db
        .select({ pixelProductId: metenziProductMappings.pixelProductId })
        .from(metenziProductMappings)
        .where(eq(metenziProductMappings.metenziProductId, keyItem.productId))
        .limit(1);

      if (!mapping?.pixelProductId) {
        logger.warn({ metenziProductId: keyItem.productId, orderId: order.id, hint: "Check metenziProductMappings table — run GET /admin/metenzi/mappings to see stored IDs" }, "No Pixel mapping for key.productId — skipping");
        continue;
      }

      const [dbItem] = await db
        .select({ id: orderItems.id, variantId: orderItems.variantId, productName: orderItems.productName, variantName: orderItems.variantName })
        .from(orderItems)
        .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
        .where(and(eq(orderItems.orderId, order.id), eq(productVariants.productId, mapping.pixelProductId)))
        .limit(1);

      if (!dbItem) {
        logger.warn({ metenziProductId: keyItem.productId, pixelProductId: mapping.pixelProductId }, "No matching order item for key");
        continue;
      }

      const key = keyItem.code;
      const encryptedKey = encrypt(key);
      const keyMask = key.length <= 8 ? key.slice(0, 2) + "****" : key.slice(0, 4) + "****" + key.slice(-4);
      await db.insert(licenseKeys).values({
        variantId: dbItem.variantId,
        keyValue: encryptedKey,
        keyMask,
        status: "SOLD",
        source: "API",
        orderItemId: dbItem.id,
        soldAt: new Date(),
      });
      keysToDeliver.push({ productName: dbItem.productName, variant: dbItem.variantName, licenseKey: key });
    }
  } else {
    // Fallback: legacy format where items have inline keys array
    for (const item of data.items ?? []) {
      const inlineKeys = item.keys ?? [];
      if (inlineKeys.length === 0) continue;
      const metenziProductId = (item.productId ?? item.variantId) as string | undefined;
      if (!metenziProductId) continue;

      const [mapping] = await db
        .select({ pixelProductId: metenziProductMappings.pixelProductId })
        .from(metenziProductMappings)
        .where(eq(metenziProductMappings.metenziProductId, metenziProductId))
        .limit(1);
      if (!mapping?.pixelProductId) continue;

      const [dbItem] = await db
        .select({ id: orderItems.id, variantId: orderItems.variantId, productName: orderItems.productName, variantName: orderItems.variantName })
        .from(orderItems)
        .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
        .where(and(eq(orderItems.orderId, order.id), eq(productVariants.productId, mapping.pixelProductId)))
        .limit(1);
      if (!dbItem) continue;

      for (const key of inlineKeys) {
        const encryptedKey = encrypt(key);
        const keyMask = key.length <= 8 ? key.slice(0, 2) + "****" : key.slice(0, 4) + "****" + key.slice(-4);
        await db.insert(licenseKeys).values({ variantId: dbItem.variantId, keyValue: encryptedKey, keyMask, status: "SOLD", source: "API", orderItemId: dbItem.id, soldAt: new Date() });
        keysToDeliver.push({ productName: dbItem.productName, variant: dbItem.variantName, licenseKey: key });
      }
    }
  }

  if (keysToDeliver.length === 0) {
    // Webhook fired but no keys extracted — keep PROCESSING so cron poll retries
    logger.warn({ orderId: order.id, metenziOrderId, topLevelKeyCount: topLevelKeys.length }, "keys.delivered: no keys matched mapping — keeping PROCESSING for retry");
    await logAuditEvent("UPDATE", "order", order.id, {
      webhookEvent: "order.fulfilled",
      metenziOrderId,
      keysDelivered: 0,
      warning: "no_keys_matched",
      topLevelKeys: topLevelKeys.map(k => ({ productId: k.productId, codeType: k.codeType })),
    });
    return;
  }

  await db
    .update(orders)
    .set({ status: "COMPLETED", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

  // Award loyalty points if the order belongs to a registered user
  if (order.userId) {
    awardOrderPoints(order.userId, order.id, parseFloat(order.totalUsd)).catch((err) =>
      logger.error({ err, orderId: order.id }, "Failed to award loyalty points on webhook COMPLETED (non-fatal)"),
    );
  }

  if (keysToDeliver.length > 0 && order.email) {
    sendKeyDeliveryEmail(order.email, {
      orderRef: order.orderNumber,
      customerName: "Customer",
      keys: keysToDeliver,
    }).catch((err) =>
      logger.error({ err }, "Failed to enqueue key delivery email from webhook"),
    );
  }

  await logAuditEvent("UPDATE", "order", order.id, {
    webhookEvent: "order.fulfilled",
    metenziOrderId,
    keysDelivered: keysToDeliver.length,
  });
}

async function handleOrderBackorder(data: OrderEventData) {
  const metenziOrderId = data.id ?? data.orderId ?? "";
  logger.info({ metenziOrderId }, "Processing order.backorder webhook");

  const order = await findOrderByMetenziId(metenziOrderId);
  if (order) {
    await db
      .update(orders)
      .set({ status: "BACKORDERED", notes: "Backordered: awaiting stock from supplier", updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    if (order.email) {
      const subject = `Your order ${order.orderNumber} is on backorder`;
      const html = `<p>Hi,</p>
<p>Your order <strong>${order.orderNumber}</strong> has been placed on backorder.</p>
<p>We are awaiting stock from our supplier. Your order will be fulfilled automatically as soon as the keys are available — no action needed on your part.</p>
<p>You will receive your license key(s) by email once the order is fulfilled.</p>
<p>Thank you for your patience.</p>`;
      enqueueEmail(order.email, subject, html, { type: "backorder-notification", orderId: order.id }).catch((err) =>
        logger.error({ err, orderId: order.id }, "Failed to enqueue backorder notification email"),
      );
    }
  }

  await logAuditEvent("UPDATE", "order", order?.id ?? null, {
    webhookEvent: "order.backorder",
    metenziOrderId,
    reason: data.reason,
  });
}

async function handleOrderCancelled(data: OrderEventData) {
  const metenziOrderId = data.id ?? data.orderId ?? "";
  logger.info({ metenziOrderId }, "Processing order.cancelled webhook");

  const order = await findOrderByMetenziId(metenziOrderId);
  if (order) {
    await db
      .update(orders)
      .set({ status: "FAILED", notes: `Cancelled by supplier: ${data.reason ?? "unknown"}`, updatedAt: new Date() })
      .where(eq(orders.id, order.id));
  }

  await logAuditEvent("UPDATE", "order", order?.id ?? null, {
    webhookEvent: "order.cancelled",
    metenziOrderId,
    reason: data.reason,
  });
}

async function handleClaimOpened(data: ClaimEventData) {
  logger.info({ claimId: data.claimId, orderId: data.orderId }, "Processing claim.opened webhook");

  const order = await findOrderByMetenziId(data.orderId);

  await logAuditEvent("CREATE", "claim", null, {
    webhookEvent: "claim.opened",
    metenziClaimId: data.claimId,
    metenziOrderId: data.orderId,
    localOrderId: order?.id,
    reason: data.reason,
  });
}

async function handleClaimResolved(data: ClaimEventData) {
  logger.info({ claimId: data.claimId, orderId: data.orderId }, "Processing claim.resolved webhook");

  const order = await findOrderByMetenziId(data.orderId);

  await logAuditEvent("UPDATE", "claim", null, {
    webhookEvent: "claim.resolved",
    metenziClaimId: data.claimId,
    metenziOrderId: data.orderId,
    localOrderId: order?.id,
    resolution: data.resolution,
    status: data.status,
  });
}

export async function handleWebhookEvent(event: string, data: unknown) {
  switch (event) {
    // Our internal names (used by redeliver-keys endpoint)
    case "order.fulfilled":
    // Metenzi actual event name
    case "keys.delivered":
      await handleOrderFulfilled(data as FulfilledData);
      break;
    case "order.backorder":
      await handleOrderBackorder(data as OrderEventData);
      break;
    // backorder.fulfilled = Metenzi has received stock and fulfilled the backorder — deliver keys
    case "backorder.fulfilled":
      await handleOrderFulfilled(data as FulfilledData);
      break;
    case "order.cancelled":
      await handleOrderCancelled(data as OrderEventData);
      break;
    case "claim.opened":
    case "claim.created":
      await handleClaimOpened(data as ClaimEventData);
      break;
    case "claim.resolved":
      await handleClaimResolved(data as ClaimEventData);
      break;
    case "order.status_changed": {
      // Metenzi sends status changes as one event — dispatch by status value
      const d = data as Record<string, unknown>;
      const status = (d.status ?? d.currentStatus ?? "") as string;
      if (status === "cancelled" || status === "CANCELLED") {
        await handleOrderCancelled({ id: d.id as string, orderId: d.orderId as string, reason: d.reason as string | undefined });
      } else if (status === "backordered" || status === "BACKORDERED") {
        await handleOrderBackorder({ id: d.id as string, orderId: d.orderId as string, reason: d.reason as string | undefined });
      } else {
        logger.info({ event, status }, "order.status_changed with unhandled status — logged only");
        await logAuditEvent("UPDATE", "order", null, { webhookEvent: event, data, status: "unhandled_status" });
      }
      break;
    }
    default:
      logger.warn({ event }, "Unknown webhook event type received");
      await logAuditEvent("CREATE", "webhook", null, {
        webhookEvent: event,
        data,
        status: "unhandled",
      });
  }
}
