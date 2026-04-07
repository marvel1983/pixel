import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  licenseKeys,
  auditLog,
  users,
} from "@workspace/db/schema";
import { encrypt } from "../lib/encryption";
import { sendKeyDeliveryEmail } from "../lib/email";
import { logger } from "../lib/logger";

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

  const existingKeys = await db
    .select({ id: licenseKeys.id })
    .from(licenseKeys)
    .innerJoin(orderItems, eq(licenseKeys.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, order.id))
    .limit(1);

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
    const variantId = parseInt(item.variantId, 10);
    if (Number.isNaN(variantId)) continue;

    const dbItems = await db
      .select({ id: orderItems.id, productName: orderItems.productName, variantName: orderItems.variantName })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, order.id), eq(orderItems.variantId, variantId)))
      .limit(1);

    const dbItem = dbItems[0];
    const keys = item.keys ?? [];

    for (const key of keys) {
      const encryptedKey = encrypt(key);
      const keyMask = key.length <= 8 ? key.slice(0, 2) + "****" : key.slice(0, 4) + "****" + key.slice(-4);
      await db.insert(licenseKeys).values({
        variantId,
        keyValue: encryptedKey,
        keyMask,
        status: "SOLD",
        source: "API",
        orderItemId: dbItem?.id,
        soldAt: new Date(),
      });

      keysToDeliver.push({
        productName: dbItem?.productName ?? "Product",
        variant: dbItem?.variantName ?? "Standard",
        licenseKey: key,
      });
    }
  }

  await db
    .update(orders)
    .set({ status: "COMPLETED", updatedAt: new Date() })
    .where(eq(orders.id, order.id));

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
    case "order.fulfilled":
      await handleOrderFulfilled(data as FulfilledData);
      break;
    case "order.backorder":
      await handleOrderBackorder(data as OrderEventData);
      break;
    case "order.cancelled":
      await handleOrderCancelled(data as OrderEventData);
      break;
    case "claim.opened":
      await handleClaimOpened(data as ClaimEventData);
      break;
    case "claim.resolved":
      await handleClaimResolved(data as ClaimEventData);
      break;
    default:
      logger.warn({ event }, "Unknown webhook event type received");
      await logAuditEvent("CREATE", "webhook", null, {
        webhookEvent: event,
        data,
        status: "unhandled",
      });
  }
}
