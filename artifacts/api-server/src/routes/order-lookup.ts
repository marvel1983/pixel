import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, or, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, productVariants, products, type Order } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { paramString } from "../lib/route-params";
import { orderLookupLimit } from "../middleware/rate-limit";

const router = Router();

const lookupSchema = z.object({
  orderNumber: z.string().min(1).max(50),
  email: z.string().email(),
});

const orderNumberSchema = z.string().min(1).max(50);
const emailSchema = z.string().email();

async function fetchOrderWithKeys(orderId: number) {
  const rows = await db
    .select({
      id: orderItems.id,
      variantId: orderItems.variantId,
      productName: orderItems.productName,
      variantName: orderItems.variantName,
      priceUsd: orderItems.priceUsd,
      quantity: orderItems.quantity,
      productId: productVariants.productId,
      imageUrl: products.imageUrl,
      activationInstructions: products.activationInstructions,
    })
    .from(orderItems)
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .leftJoin(products, eq(productVariants.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  // Batch-fetch all license keys for all order items in one query
  const itemIds = rows.map((r) => r.id);
  const allKeys = itemIds.length
    ? await db.select().from(licenseKeys).where(inArray(licenseKeys.orderItemId, itemIds))
    : [];

  const keysByItem = new Map<number, typeof allKeys>();
  for (const k of allKeys) {
    if (k.orderItemId == null) continue;
    const list = keysByItem.get(k.orderItemId) ?? [];
    list.push(k);
    keysByItem.set(k.orderItemId, list);
  }

  return {
    items: rows.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productId: i.productId ?? 0,
      productName: i.productName,
      variantName: i.variantName,
      imageUrl: i.imageUrl ?? null,
      priceUsd: i.priceUsd,
      quantity: i.quantity,
    })),
    licenseKeys: rows.map((item) => ({
      orderItemId: item.id,
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      instructions: item.activationInstructions ?? null,
      keys: (keysByItem.get(item.id) ?? []).map((k) => ({
        id: k.id,
        value: safeDecrypt(k.keyValue),
        status: k.status,
      })),
    })),
  };
}

function formatOrderResponse(order: Order) {
  const subtotal = parseFloat(order.subtotalUsd);
  const discount = parseFloat(order.discountUsd ?? "0");
  const total = parseFloat(order.totalUsd);
  const tax = parseFloat(order.taxAmountUsd ?? "0");
  const cpp = parseFloat(order.cppAmountUsd ?? "0");
  // Processing fee is not stored; derive it from totals
  const processingFeeUsd = Math.max(0, total - (subtotal - discount) - tax - cpp).toFixed(2);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalUsd: order.subtotalUsd,
    discountUsd: order.discountUsd,
    totalUsd: order.totalUsd,
    processingFeeUsd,
    taxRate: order.taxRate,
    taxAmountUsd: order.taxAmountUsd,
    cppAmountUsd: order.cppAmountUsd,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
  };
}

router.post("/orders/lookup", orderLookupLimit, async (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Order number and email are required" });
    return;
  }

  const { orderNumber, email } = parsed.data;

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderNumber, orderNumber),
          eq(orders.guestEmail, email),
        ),
      )
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const details = await fetchOrderWithKeys(order.id);
    res.json({ order: formatOrderResponse(order), ...details });
  } catch (err) {
    logger.error({ err }, "Order lookup failed");
    res.status(500).json({ error: "Failed to look up order" });
  }
});

router.get("/account/orders", requireAuth, async (req, res) => {
  const userEmail = req.user!.email;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(
        or(
          eq(orders.userId, req.user!.userId),
          eq(orders.guestEmail, userEmail),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    // Batch-fetch all order items for the current page in one query
    const orderIds = userOrders.map((o) => o.id);
    const allItems = orderIds.length
      ? await db.select({ orderId: orderItems.orderId, productName: orderItems.productName })
          .from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [];
    const itemsByOrder = new Map<number, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    const result = userOrders.map((order) => {
        const items = itemsByOrder.get(order.id) ?? [];
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalUsd: order.totalUsd,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
          itemCount: items.length,
          firstProduct: items[0]?.productName ?? "Unknown",
        };
      });

    res.json({ orders: result, page, hasMore: userOrders.length === limit });
  } catch (err) {
    logger.error({ err }, "Order history fetch failed");
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

function safeDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}

export default router;
