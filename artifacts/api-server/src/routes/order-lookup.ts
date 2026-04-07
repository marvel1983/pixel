import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys, type Order } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";

const router = Router();

const lookupSchema = z.object({
  orderNumber: z.string().min(1).max(50),
  email: z.string().email(),
});

const orderNumberSchema = z.string().min(1).max(50);
const emailSchema = z.string().email();

async function fetchOrderWithKeys(orderId: number) {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const allKeys = await Promise.all(
    items.map(async (item) => {
      const itemKeys = await db
        .select()
        .from(licenseKeys)
        .where(eq(licenseKeys.orderItemId, item.id));
      return {
        orderItemId: item.id,
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        keys: itemKeys.map((k) => ({
          id: k.id,
          value: safeDecrypt(k.keyValue),
          status: k.status,
        })),
      };
    }),
  );

  return {
    items: items.map((i) => ({
      id: i.id,
      productName: i.productName,
      variantName: i.variantName,
      priceUsd: i.priceUsd,
      quantity: i.quantity,
    })),
    licenseKeys: allKeys,
  };
}

function formatOrderResponse(order: Order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalUsd: order.subtotalUsd,
    discountUsd: order.discountUsd,
    totalUsd: order.totalUsd,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt,
  };
}

router.post("/orders/lookup", async (req, res) => {
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

router.get("/orders/:orderNumber", async (req, res) => {
  const parsed = orderNumberSchema.safeParse(req.params.orderNumber);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order number" });
    return;
  }

  const email = req.query.email;
  const emailParsed = emailSchema.safeParse(email);
  if (!emailParsed.success) {
    res.status(400).json({ error: "Email query parameter required for verification" });
    return;
  }

  try {
    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.orderNumber, parsed.data),
          eq(orders.guestEmail, emailParsed.data),
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
    logger.error({ err }, "Order fetch failed");
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.get("/account/orders", async (req, res) => {
  const emailParsed = emailSchema.safeParse(req.query.email);
  if (!emailParsed.success) {
    res.status(400).json({ error: "Valid email is required" });
    return;
  }

  try {
    const userOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.guestEmail, emailParsed.data))
      .orderBy(desc(orders.createdAt));

    const result = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));
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
      }),
    );

    res.json({ orders: result });
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
