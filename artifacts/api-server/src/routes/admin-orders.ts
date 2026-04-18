import { Router } from "express";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, users, coupons } from "@workspace/db/schema";
import { eq, desc, sql, and, or, ilike, gte, lte, inArray, count, sum } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { decrypt } from "../lib/encryption";
import { paramString } from "../lib/route-params";
import { awardOrderPoints, reverseOrderLoyaltyPoints } from "../services/loyalty-service";
import { logger } from "../lib/logger";

const router = Router();

router.get("/admin/orders/export", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const idsParam = req.query.ids as string | undefined;
  const conditions = buildFilters(req.query);
  if (idsParam) {
    const ids = idsParam.split(",").map(Number).filter(Number.isInteger);
    if (ids.length > 0) conditions.push(inArray(orders.id, ids));
  }

  const rows = await db
    .select({
      orderNumber: orders.orderNumber, email: orders.guestEmail, status: orders.status,
      subtotal: orders.subtotalUsd, discount: orders.discountUsd, total: orders.totalUsd,
      cpp: orders.cppSelected, cppAmount: orders.cppAmountUsd,
      payment: orders.paymentMethod, currency: orders.currencyCode, createdAt: orders.createdAt,
    })
    .from(orders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const header = "Order #,Email,Status,Subtotal,Discount,CPP,CPP Amount,Total,Payment,Currency,Date\n";
  const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = rows.map((r) =>
    [r.orderNumber, r.email, r.status, r.subtotal, r.discount, r.cpp ? "Yes" : "No", r.cppAmount, r.total, r.payment, r.currency, r.createdAt?.toISOString()].map(esc).join(",")
  ).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=orders-${Date.now()}.csv`);
  res.send(header + csv);
});

router.get("/admin/orders", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;
  const conditions = buildFilters(req.query);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total: totalCount }] = await db.select({ total: count() }).from(orders).where(whereClause);
  const [{ revenue }] = await db.select({ revenue: sum(orders.totalUsd) }).from(orders).where(whereClause);

  const rows = await db
    .select({
      id: orders.id, orderNumber: orders.orderNumber, guestEmail: orders.guestEmail,
      userId: orders.userId, status: orders.status, paymentMethod: orders.paymentMethod,
      subtotalUsd: orders.subtotalUsd, discountUsd: orders.discountUsd, totalUsd: orders.totalUsd,
      cppSelected: orders.cppSelected, cppAmountUsd: orders.cppAmountUsd,
      couponId: orders.couponId, currencyCode: orders.currencyCode, createdAt: orders.createdAt,
    })
    .from(orders)
    .where(whereClause)
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  const orderIds = rows.map((r) => r.id);
  const itemsByOrder: Record<number, { productName: string; quantity: number }[]> = {};
  if (orderIds.length > 0) {
    const items = await db
      .select({ orderId: orderItems.orderId, productName: orderItems.productName, quantity: orderItems.quantity })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    for (const item of items) {
      (itemsByOrder[item.orderId] ??= []).push({ productName: item.productName, quantity: item.quantity });
    }
  }

  const result = rows.map((r) => ({
    ...r,
    items: itemsByOrder[r.id] ?? [],
    itemCount: (itemsByOrder[r.id] ?? []).reduce((s, i) => s + i.quantity, 0),
  }));

  res.json({ orders: result, total: totalCount, revenue: revenue ?? "0", page, limit });
});

router.get("/admin/orders/:id", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  const itemIds = items.map((i) => i.id);
  let keys: { orderItemId: number | null; id: number; keyValue: string; status: string; soldAt: Date | null }[] = [];
  if (itemIds.length > 0) {
    keys = await db
      .select({ orderItemId: licenseKeys.orderItemId, id: licenseKeys.id, keyValue: licenseKeys.keyValue, status: licenseKeys.status, soldAt: licenseKeys.soldAt })
      .from(licenseKeys)
      .where(inArray(licenseKeys.orderItemId, itemIds));
  }

  const decryptedKeys = keys.map((k) => ({ ...k, keyValue: safeDecrypt(k.keyValue) }));

  let customer = null;
  if (order.userId) {
    const [u] = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, order.userId));
    customer = u ?? null;
  }

  let coupon = null;
  if (order.couponId) {
    const [c] = await db.select({ id: coupons.id, code: coupons.code, discountValue: coupons.discountValue }).from(coupons).where(eq(coupons.id, order.couponId));
    coupon = c ?? null;
  }

  const timeline = [
    { event: "Order created", date: order.createdAt.toISOString() },
    ...(order.paymentIntentId ? [{ event: "Payment processed", date: order.updatedAt.toISOString() }] : []),
    ...(order.externalOrderId ? [{ event: "Sent to Metenzi", date: order.updatedAt.toISOString() }] : []),
    ...(order.status === "COMPLETED" ? [{ event: "Order completed", date: order.updatedAt.toISOString() }] : []),
    ...(order.status === "REFUNDED" ? [{ event: "Order refunded", date: order.updatedAt.toISOString() }] : []),
    ...(order.status === "FAILED" ? [{ event: "Order failed", date: order.updatedAt.toISOString() }] : []),
  ];

  res.json({ order, items, licenseKeys: decryptedKeys, customer, coupon, timeline });
});

router.patch("/admin/orders/:id/status", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }
  const validStatuses = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
  const { status } = req.body;
  if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  const [order] = await db.select({ id: orders.id, userId: orders.userId, totalUsd: orders.totalUsd, subtotalUsd: orders.subtotalUsd }).from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));

  // Loyalty side-effects (non-fatal)
  // Use subtotalUsd so customers earn points on product value even when paying with gift codes/coupons
  if (status === "COMPLETED" && order.userId) {
    awardOrderPoints(order.userId, id, parseFloat(order.subtotalUsd ?? order.totalUsd)).catch((err) => {
      logger.error({ err, orderId: id }, "Failed to award loyalty points on admin status change (non-fatal)");
    });
  } else if ((status === "REFUNDED" || status === "PARTIALLY_REFUNDED") && order.userId) {
    const orderTotal = parseFloat(order.totalUsd);
    // For a full refund transition treat the refund amount as the full order total
    const refundAmount = status === "REFUNDED" ? orderTotal : orderTotal;
    reverseOrderLoyaltyPoints(id, refundAmount, orderTotal).catch((err) => {
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
  await handleWebhookEvent("order.fulfilled", {
    id: metenziOrder.id,
    keys: metenziOrder.keys ?? [],
  });

  res.json({ success: true });
});

// POST /admin/orders/:id/retry-fulfillment
// Re-triggers Metenzi order creation for a PROCESSING order whose fulfillment failed
// (e.g. insufficient Metenzi credit, API down). Safe to call multiple times — idempotent.
router.post("/admin/orders/:id/retry-fulfillment", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, notes: orders.notes, externalOrderId: orders.externalOrderId })
    .from(orders)
    .where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.externalOrderId) { res.status(400).json({ error: "Order already has a Metenzi order ID — use redeliver-keys instead" }); return; }

  // Re-enqueue the fulfillment job
  const { enqueueJob } = await import("../lib/job-queue");
  const items = await db
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity, productVariants: orderItems.variantId })
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  if (items.length === 0) { res.status(400).json({ error: "No order items found" }); return; }

  const { productVariants } = await import("@workspace/db/schema");
  const variantRows = await db.select({ id: productVariants.id, productId: productVariants.productId }).from(productVariants)
    .where(inArray(productVariants.id, items.map((i) => i.variantId)));
  const productIds = [...new Set(variantRows.map((v) => v.productId))];

  await enqueueJob({
    queue: "order-processing",
    name: "metenzi-retry-fulfillment",
    priority: 3,
    maxAttempts: 3,
    payload: { orderId: id, productIds },
  });

  logger.info({ orderId: id, orderNumber: order.orderNumber }, "Admin: retry fulfillment enqueued");
  res.json({ success: true, message: `Fulfillment retry enqueued for order ${order.orderNumber}` });
});

function buildFilters(query: Record<string, unknown>) {
  const conditions = [];
  const search = query.search as string | undefined;
  if (search?.trim()) conditions.push(or(ilike(orders.orderNumber, `%${search}%`), ilike(orders.guestEmail, `%${search}%`)));
  const status = query.status as string | undefined;
  if (status && status !== "ALL") conditions.push(eq(orders.status, status as typeof orders.$inferSelect.status));
  const from = query.from as string | undefined;
  if (from) conditions.push(gte(orders.createdAt, new Date(from)));
  const to = query.to as string | undefined;
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(orders.createdAt, endOfDay));
  }
  const hasCoupon = query.hasCoupon as string | undefined;
  if (hasCoupon === "true") conditions.push(sql`${orders.couponId} IS NOT NULL`);
  const hasCpp = query.hasCpp as string | undefined;
  if (hasCpp === "true") conditions.push(eq(orders.cppSelected, true));
  return conditions;
}

function safeDecrypt(value: string): string {
  try { return decrypt(value); } catch { return value; }
}

export default router;
