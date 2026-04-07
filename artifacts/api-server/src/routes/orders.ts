import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { orders, orderItems } from "@workspace/db/schema";
import { logger } from "../lib/logger";

const router = Router();

const currencyStr = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid currency format");

const billingSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  country: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  zip: z.string().min(1),
});

const itemSchema = z.object({
  variantId: z.number().int().positive(),
  productId: z.number().int().positive(),
  productName: z.string().min(1),
  variantName: z.string().min(1),
  imageUrl: z.string().nullable(),
  priceUsd: currencyStr,
  quantity: z.number().int().positive().max(99),
  platform: z.string().optional(),
});

const orderSchema = z.object({
  billing: billingSchema,
  items: z.array(itemSchema).min(1).max(50),
  coupon: z
    .object({
      code: z.string().min(1).max(50),
      pct: z.number().min(0).max(100),
      label: z.string(),
    })
    .nullable()
    .optional(),
  cppSelected: z.boolean().optional(),
  total: currencyStr,
  guestPassword: z.string().min(8).optional(),
});

const CPP_RATE = 0.05;

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PC-${ts}-${rand}`;
}

router.post("/orders", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order data", details: parsed.error.flatten() });
    return;
  }

  const { billing, items, coupon, cppSelected, total } = parsed.data;

  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.priceUsd) * it.quantity,
    0,
  );
  const discountAmount = coupon ? subtotal * (coupon.pct / 100) : 0;
  const cppAmount = cppSelected ? Math.round(subtotal * CPP_RATE * 100) / 100 : 0;
  const computedTotal = subtotal - discountAmount + cppAmount;

  if (Math.abs(computedTotal - parseFloat(total)) > 0.02) {
    res.status(400).json({ error: "Total mismatch. Please refresh and try again." });
    return;
  }

  const orderNumber = generateOrderNumber();

  try {
    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          guestEmail: billing.email,
          status: "COMPLETED",
          subtotalUsd: subtotal.toFixed(2),
          discountUsd: discountAmount.toFixed(2),
          totalUsd: computedTotal.toFixed(2),
          paymentMethod: "CARD",
          paymentIntentId: `sim_${Date.now()}`,
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        items.map((item) => ({
          orderId: order.id,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          priceUsd: item.priceUsd,
          quantity: item.quantity,
        })),
      );

      return order;
    });

    logger.info({ orderNumber, email: billing.email, total: computedTotal.toFixed(2) }, "Order created");

    res.status(201).json({
      orderNumber,
      status: "COMPLETED",
      message: "Order placed successfully",
    });
  } catch (err) {
    logger.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Failed to process order" });
  }
});

export default router;
