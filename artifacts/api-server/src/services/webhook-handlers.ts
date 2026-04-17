import { eq, and, inArray } from "drizzle-orm";
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
import { sendKeyDeliveryEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { awardOrderPoints } from "./loyalty-service";

interface FulfilledItem {
  variantId: string;
  quantity: number;
  keys?: string[];
}

interface FulfilledData {
  orderId: string;
  items: FulfilledItem[];
}

interface OrderEventData {
  orderId: string;
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
    .where(eq(orders.externalOrderId, metenziOrderId))
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
  logger.info({ metenziOrderId: data.orderId }, "Processing order.fulfilled webhook");

  const order = await findOrderByMetenziId(data.orderId);
  if (!order) {
    logger.warn({ metenziOrderId: data.orderId }, "No matching local order for fulfilled webhook");
    await logAuditEvent("UPDATE", "order", null, {
      webhookEvent: "order.fulfilled",
      metenziOrderId: data.orderId,
      error: "no matching local order",
    });
    return;
  }

  // Idempotency: check for existing keys linked to any order item OR directly to this order
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
    logger.info({ orderId: order.id }, "Webhook order.fulfilled already processed (idempotent skip)");
    await logAuditEvent("UPDATE", "order", order.id, {
      webhookEvent: "order.fulfilled",
      metenziOrderId: data.orderId,
      duplicate: true,
    });
    return;
  }

  const keysToDeliver: { productName: string; variant: string; licenseKey: string }[] = [];

  for (const item of data.items) {
    const keys = item.keys ?? [];
    if (keys.length === 0) continue;

    // Resolve Pixel order item via metenzi_product_mappings (metenziProductId → pixelProductId → variant → orderItem)
    const [mapping] = await db
      .select({ pixelProductId: metenziProductMappings.pixelProductId })
      .from(metenziProductMappings)
      .where(eq(metenziProductMappings.metenziProductId, item.variantId))
      .limit(1);

    if (!mapping?.pixelProductId) {
      logger.warn({ metenziProductId: item.variantId, orderId: order.id }, "No Pixel mapping for Metenzi product in webhook — skipping keys for this item");
      continue;
    }

    // Find the order item: join orderItems → productVariants to match by pixelProductId
    const [dbItem] = await db
      .select({ id: orderItems.id, variantId: orderItems.variantId, productName: orderItems.productName, variantName: orderItems.variantName })
      .from(orderItems)
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(and(eq(orderItems.orderId, order.id), eq(productVariants.productId, mapping.pixelProductId)))
      .limit(1);

    if (!dbItem) {
      logger.warn({ metenziProductId: item.variantId, pixelProductId: mapping.pixelProductId, orderId: order.id }, "No matching order item found for Metenzi product");
      continue;
    }

    for (const key of keys) {
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

      keysToDeliver.push({
        productName: dbItem.productName,
        variant: dbItem.variantName,
        licenseKey: key,
      });
    }
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
    metenziOrderId: data.orderId,
    keysDelivered: keysToDeliver.length,
  });
}

async function handleOrderBackorder(data: OrderEventData) {
  logger.info({ metenziOrderId: data.orderId }, "Processing order.backorder webhook");

  const order = await findOrderByMetenziId(data.orderId);
  if (order) {
    await db
      .update(orders)
      .set({ status: "PROCESSING", notes: "Backorder: awaiting supplier stock", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
  }

  await logAuditEvent("UPDATE", "order", order?.id ?? null, {
    webhookEvent: "order.backorder",
    metenziOrderId: data.orderId,
    reason: data.reason,
  });
}

async function handleOrderCancelled(data: OrderEventData) {
  logger.info({ metenziOrderId: data.orderId }, "Processing order.cancelled webhook");

  const order = await findOrderByMetenziId(data.orderId);
  if (order) {
    await db
      .update(orders)
      .set({ status: "FAILED", notes: `Cancelled by supplier: ${data.reason ?? "unknown"}`, updatedAt: new Date() })
      .where(eq(orders.id, order.id));
  }

  await logAuditEvent("UPDATE", "order", order?.id ?? null, {
    webhookEvent: "order.cancelled",
    metenziOrderId: data.orderId,
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
    case "backorder.fulfilled":
      await handleOrderBackorder(data as OrderEventData);
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
        await handleOrderCancelled({ orderId: d.orderId as string, reason: d.reason as string | undefined });
      } else if (status === "backordered" || status === "BACKORDERED") {
        await handleOrderBackorder({ orderId: d.orderId as string, reason: d.reason as string | undefined });
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
