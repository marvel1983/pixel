import { Router } from "express";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, users, coupons } from "@workspace/db/schema";
import { eq, desc, sql, and, or, ilike, gte, lte, inArray, count, sum } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { decrypt } from "../lib/encryption";
import { paramString } from "../lib/route-params";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createStripeClient } from "../lib/stripe-client";
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

  const [[{ total: totalCount }], [{ revenue }], rows] = await Promise.all([
    db.select({ total: count() }).from(orders).where(whereClause),
    db.select({ revenue: sum(orders.totalUsd) }).from(orders).where(whereClause),
    db.select({
      id: orders.id, orderNumber: orders.orderNumber, guestEmail: orders.guestEmail,
      userId: orders.userId, status: orders.status, paymentMethod: orders.paymentMethod,
      subtotalUsd: orders.subtotalUsd, discountUsd: orders.discountUsd, totalUsd: orders.totalUsd,
      cppSelected: orders.cppSelected, cppAmountUsd: orders.cppAmountUsd,
      couponId: orders.couponId, currencyCode: orders.currencyCode, createdAt: orders.createdAt,
      attribution: orders.attribution,
    }).from(orders).where(whereClause).orderBy(desc(orders.createdAt)).limit(limit).offset(offset),
  ]);

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
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid order ID" }); return; }

  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const [items, customerRows, couponRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    order.userId
      ? db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, createdAt: users.createdAt })
          .from(users).where(eq(users.id, order.userId))
      : Promise.resolve([] as { id: number; email: string; firstName: string | null; lastName: string | null; createdAt: Date }[]),
    order.couponId
      ? db.select({ id: coupons.id, code: coupons.code, discountValue: coupons.discountValue })
          .from(coupons).where(eq(coupons.id, order.couponId))
      : Promise.resolve([] as { id: number; code: string; discountValue: string }[]),
  ]);

  const itemIds = items.map((i) => i.id);
  let keys: { orderItemId: number | null; id: number; keyValue: string; status: string; soldAt: Date | null }[] = [];
  if (itemIds.length > 0) {
    keys = await db
      .select({ orderItemId: licenseKeys.orderItemId, id: licenseKeys.id, keyValue: licenseKeys.keyValue, status: licenseKeys.status, soldAt: licenseKeys.soldAt })
      .from(licenseKeys)
      .where(inArray(licenseKeys.orderItemId, itemIds));
  }

  const decryptedKeys = keys.map((k) => ({ ...k, keyValue: safeDecrypt(k.keyValue) }));
  const customer = customerRows[0] ?? null;
  const coupon = couponRows[0] ?? null;

  const timeline = [
    { event: "Order created", date: order.createdAt.toISOString() },
    ...(order.paymentIntentId ? [{ event: "Payment processed", date: order.updatedAt.toISOString() }] : []),
    ...(order.externalOrderId ? [{ event: "Sent to Metenzi", date: order.updatedAt.toISOString() }] : []),
    ...(order.status === "COMPLETED" ? [{ event: "Order completed", date: order.updatedAt.toISOString() }] : []),
    ...(order.status === "REFUNDED" ? [{ event: "Order refunded", date: order.updatedAt.toISOString() }] : []),
    ...(order.status === "FAILED" ? [{ event: "Order failed", date: order.updatedAt.toISOString() }] : []),
  ];

  let stripePaymentDetails: {
    status: string; cardBrand?: string; cardLast4?: string;
    cardExpMonth?: number; cardExpYear?: number; cardCountry?: string; cardFunding?: string;
    declineCode?: string; declineMessage?: string;
  } | null = null;

  if (order.paymentMethod === "CARD" || order.paymentMethod === "MIXED") {
    try {
      const payConfig = await getActivePaymentConfig();
      if (payConfig?.provider === "stripe" && payConfig.secretKey) {
        const stripe = createStripeClient(payConfig.secretKey);
        let pi: import("stripe").Stripe.PaymentIntent | null = null;

        if (order.paymentIntentId) {
          pi = await stripe.paymentIntents.retrieve(order.paymentIntentId, { expand: ["latest_charge"] });
        } else {
          const results = await stripe.paymentIntents.search({
            query: `metadata['orderNumber']:'${order.orderNumber}'`,
            expand: ["data.latest_charge"],
            limit: 1,
          });
          if (results.data.length > 0) {
            pi = results.data[0];
            await db.update(orders).set({ paymentIntentId: pi.id }).where(eq(orders.id, id)).catch((err) => {
              logger.warn({ err, orderId: id }, "Failed to cache Stripe payment intent ID (non-fatal)");
            });
          }
        }

        if (pi) {
          const charge = typeof pi.latest_charge === "object" && pi.latest_charge ? pi.latest_charge as import("stripe").Stripe.Charge : null;
          const card = charge?.payment_method_details?.card;
          stripePaymentDetails = {
            status: pi.status,
            cardBrand: card?.brand ?? undefined, cardLast4: card?.last4 ?? undefined,
            cardExpMonth: card?.exp_month, cardExpYear: card?.exp_year,
            cardCountry: card?.country ?? undefined, cardFunding: card?.funding ?? undefined,
            declineCode: (charge?.failure_code ?? pi.last_payment_error?.decline_code) ?? undefined,
            declineMessage: (charge?.failure_message ?? pi.last_payment_error?.message) ?? undefined,
          };
        }
      }
    } catch (err) {
      logger.warn({ err, orderId: id }, "Could not fetch Stripe payment details (non-fatal)");
    }
  }

  res.json({ order, items, licenseKeys: decryptedKeys, customer, coupon, timeline, stripePaymentDetails });
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
