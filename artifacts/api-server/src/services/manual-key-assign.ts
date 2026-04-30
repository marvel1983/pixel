import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, auditLog, productVariants, products, users } from "@workspace/db/schema";
import { encrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { awardOrderPoints } from "./loyalty-service";
import { sendKeyDeliveryEmail } from "../lib/email";

export interface ManualKeyInput {
  orderItemId: number;
  key: string;
}

export interface ManualAssignResult {
  keysAdded: number;
  duplicatesSkipped: number;
  capacityExceededSkipped: number;
  totalDelivered: number;
  totalExpected: number;
  newStatus: string;
}

interface InsertedKey {
  orderItemId: number;
  variantId: number;
  productName: string;
  variantName: string;
  rawKey: string;
}

function maskKey(k: string): string {
  return k.length <= 8 ? k.slice(0, 2) + "****" : k.slice(0, 4) + "****" + k.slice(-4);
}

/**
 * Manually assigns admin-provided keys to an order's items, validating ownership,
 * de-duplicating, capping per item quantity, then advances order status and emails
 * the customer.
 */
export async function manualAssignKeys(
  orderId: number,
  rawKeys: ManualKeyInput[],
  adminUserId: number | null,
): Promise<ManualAssignResult> {
  const cleanKeys = rawKeys
    .map((k) => ({ orderItemId: Number(k.orderItemId), key: String(k.key ?? "").trim() }))
    .filter((k) => Number.isInteger(k.orderItemId) && k.key.length > 0);
  if (cleanKeys.length === 0) throw new Error("No valid keys provided");

  const [order] = await db
    .select({
      id: orders.id, orderNumber: orders.orderNumber, status: orders.status,
      userId: orders.userId, guestEmail: orders.guestEmail,
      totalUsd: orders.totalUsd, subtotalUsd: orders.subtotalUsd,
    })
    .from(orders).where(eq(orders.id, orderId));
  if (!order) throw new Error("Order not found");

  const requestedItemIds = [...new Set(cleanKeys.map((k) => k.orderItemId))];
  const items = await db
    .select({
      id: orderItems.id, variantId: orderItems.variantId,
      productName: orderItems.productName, variantName: orderItems.variantName,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), inArray(orderItems.id, requestedItemIds)));
  if (items.length !== requestedItemIds.length) {
    throw new Error("One or more order item IDs do not belong to this order");
  }
  const itemsById = new Map(items.map((i) => [i.id, i]));

  // Existing keys: track per-item count (capacity) and per-item mask set (dedup).
  // We dedup by keyMask rather than encrypted keyValue because encrypt() is
  // non-deterministic — same plaintext → different ciphertext → false negatives.
  const existingKeys = await db
    .select({ orderItemId: licenseKeys.orderItemId, keyMask: licenseKeys.keyMask })
    .from(licenseKeys)
    .where(inArray(licenseKeys.orderItemId, requestedItemIds));
  const deliveredByItem: Record<number, number> = {};
  const masksByItem: Map<number, Set<string>> = new Map();
  for (const k of existingKeys) {
    if (k.orderItemId == null) continue;
    deliveredByItem[k.orderItemId] = (deliveredByItem[k.orderItemId] ?? 0) + 1;
    if (!k.keyMask) continue;
    if (!masksByItem.has(k.orderItemId)) masksByItem.set(k.orderItemId, new Set());
    masksByItem.get(k.orderItemId)!.add(k.keyMask);
  }

  const toInsert: Array<{
    variantId: number; keyValue: string; keyMask: string; orderItemId: number;
    _meta: InsertedKey;
  }> = [];
  let duplicatesSkipped = 0;
  let capacityExceededSkipped = 0;

  for (const k of cleanKeys) {
    const item = itemsById.get(k.orderItemId);
    if (!item) continue;
    const cur = deliveredByItem[k.orderItemId] ?? 0;
    if (cur >= item.quantity) { capacityExceededSkipped++; continue; }
    const mask = maskKey(k.key);
    const seen = masksByItem.get(k.orderItemId) ?? new Set<string>();
    if (seen.has(mask)) { duplicatesSkipped++; continue; }
    seen.add(mask);
    masksByItem.set(k.orderItemId, seen);
    deliveredByItem[k.orderItemId] = cur + 1;
    const encrypted = encrypt(k.key);
    toInsert.push({
      variantId: item.variantId, keyValue: encrypted, keyMask: mask, orderItemId: k.orderItemId,
      _meta: { orderItemId: k.orderItemId, variantId: item.variantId, productName: item.productName, variantName: item.variantName, rawKey: k.key },
    });
  }

  if (toInsert.length === 0) {
    throw new Error(
      `No keys inserted (duplicates: ${duplicatesSkipped}, over-capacity: ${capacityExceededSkipped})`,
    );
  }

  await db.insert(licenseKeys).values(
    toInsert.map((k) => ({
      variantId: k.variantId, keyValue: k.keyValue, keyMask: k.keyMask, orderItemId: k.orderItemId,
      status: "SOLD" as const, source: "MANUAL" as const, soldAt: new Date(),
    })),
  );

  // Recompute order status
  const allItems = await db.select({ id: orderItems.id, quantity: orderItems.quantity })
    .from(orderItems).where(eq(orderItems.orderId, orderId));
  const totalExpected = allItems.reduce((s, i) => s + i.quantity, 0);
  const allItemIds = allItems.map((i) => i.id);
  const totalDelivered = allItemIds.length > 0
    ? (await db.select({ id: licenseKeys.id }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, allItemIds))).length
    : 0;

  const newStatus = totalDelivered >= totalExpected ? "COMPLETED" : "PARTIALLY_DELIVERED";
  await db.update(orders).set({ status: newStatus, updatedAt: new Date() }).where(eq(orders.id, orderId));

  if (newStatus === "COMPLETED" && order.userId) {
    awardOrderPoints(order.userId, orderId, parseFloat(order.subtotalUsd ?? order.totalUsd)).catch((err) =>
      logger.error({ err, orderId }, "Failed to award loyalty points after manual assign (non-fatal)"));
  }

  // Audit trail — who, what, when
  await db.insert(auditLog).values({
    action: "UPDATE",
    entityType: "order",
    entityId: orderId,
    userId: adminUserId,
    details: {
      kind: "manual_keys_assigned",
      keysAdded: toInsert.length,
      duplicatesSkipped, capacityExceededSkipped,
      orderItemIds: toInsert.map((k) => k.orderItemId),
      maskedKeys: toInsert.map((k) => k.keyMask),
      newStatus,
    },
  }).catch((err) => logger.error({ err, orderId }, "Failed to write manual-assign audit log"));

  // Customer email (fire and forget)
  sendKeyEmailForInserted(order.id, order.orderNumber, order.userId, order.guestEmail, toInsert.map((k) => k._meta)).catch((err) =>
    logger.error({ err, orderId }, "Failed to send key delivery email after manual assign (non-fatal)"));

  logger.info({ orderId, adminUserId, keysAdded: toInsert.length, newStatus }, "Admin: manual keys assigned");

  return {
    keysAdded: toInsert.length,
    duplicatesSkipped,
    capacityExceededSkipped,
    totalDelivered,
    totalExpected,
    newStatus,
  };
}

async function resolveOrderEmail(userId: number | null, guestEmail: string | null): Promise<string | null> {
  if (guestEmail) return guestEmail;
  if (!userId) return null;
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.email ?? null;
}

async function sendKeyEmailForInserted(
  orderId: number,
  orderNumber: string,
  userId: number | null,
  guestEmail: string | null,
  inserted: InsertedKey[],
): Promise<void> {
  const email = await resolveOrderEmail(userId, guestEmail);
  if (!email || inserted.length === 0) return;

  const variantIds = [...new Set(inserted.map((k) => k.variantId))];
  const instructionRows = await db
    .select({ variantId: productVariants.id, instructions: products.activationInstructions })
    .from(productVariants)
    .leftJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, variantIds));
  const instrByVariant = new Map(instructionRows.map((r) => [r.variantId, r.instructions]));

  await sendKeyDeliveryEmail(email, {
    orderRef: orderNumber,
    customerName: "Customer",
    keys: inserted.map((k) => ({
      productName: k.productName,
      variant: k.variantName,
      licenseKey: k.rawKey,
      instructions: instrByVariant.get(k.variantId) ?? undefined,
    })),
  });
  logger.info({ orderId, recipient: email.replace(/(.{2}).+(@.+)/, "$1***$2") }, "Manual-assign: key delivery email queued");
}
