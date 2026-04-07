import { Router } from "express";
import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants } from "@workspace/db/schema";
import { executeOrderPipeline } from "../services/order-pipeline";
import { validateCouponServerSide } from "../services/coupon-service";
import { logger } from "../lib/logger";

const router = Router();

const currencyStr = z.string().regex(/^\d+(\.\d{1,2})?$/);

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
      pct: z.number(),
      label: z.string(),
    })
    .nullable()
    .optional(),
  cppSelected: z.boolean().optional(),
  total: currencyStr,
  payment: z.object({ cardToken: z.string().min(1) }),
  guestPassword: z.string().min(8).optional(),
});

const CPP_RATE = 0.05;

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PC-${ts}-${rand}`;
}

async function validateAndPriceItems(items: z.infer<typeof orderSchema>["items"]) {
  const variantIds = items.map((i) => i.variantId);
  const dbVariants = await db
    .select({ id: productVariants.id, priceUsd: productVariants.priceUsd })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds));

  if (dbVariants.length === 0) {
    return { prices: null, error: null };
  }

  const priceMap = new Map(dbVariants.map((v) => [v.id, v.priceUsd]));

  if (dbVariants.length !== variantIds.length) {
    const missing = variantIds.filter((id) => !priceMap.has(id));
    return { prices: null, error: `Variant(s) not found: ${missing.join(", ")}` };
  }

  for (const item of items) {
    const dbPrice = priceMap.get(item.variantId);
    if (dbPrice && dbPrice !== item.priceUsd) {
      return { prices: null, error: `Price changed for ${item.productName}` };
    }
  }
  return { prices: priceMap, error: null };
}

router.post("/orders", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order data", details: parsed.error.flatten() });
    return;
  }

  const { billing, items, coupon, cppSelected, total, payment } = parsed.data;

  const { error: priceError } = await validateAndPriceItems(items);
  if (priceError) {
    res.status(400).json({ error: priceError });
    return;
  }

  let serverCoupon: { code: string; pct: number; label: string } | null = null;
  if (coupon?.code) {
    serverCoupon = await validateCouponServerSide(coupon.code);
    if (!serverCoupon) {
      res.status(400).json({ error: "Invalid or expired coupon code" });
      return;
    }
  }

  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.priceUsd) * it.quantity,
    0,
  );
  const discountPct = serverCoupon?.pct ?? 0;
  const discountAmount = subtotal * (discountPct / 100);
  const cppAmount = cppSelected ? Math.round(subtotal * CPP_RATE * 100) / 100 : 0;
  const computedTotal = subtotal - discountAmount + cppAmount;

  if (Math.abs(computedTotal - parseFloat(total)) > 0.02) {
    res.status(400).json({ error: "Total mismatch. Please refresh and try again." });
    return;
  }

  try {
    const result = await executeOrderPipeline({
      billing,
      items,
      coupon: serverCoupon,
      cppSelected: cppSelected ?? false,
      subtotal,
      discountAmount,
      total: computedTotal,
      orderNumber: generateOrderNumber(),
      cardToken: payment.cardToken,
      guestPassword: parsed.data.guestPassword,
    });

    res.status(201).json({
      orderNumber: result.orderNumber,
      status: result.status,
      message: "Order placed successfully",
    });
  } catch (err) {
    logger.error({ err }, "Order pipeline failed");
    const msg = err instanceof Error ? err.message : "Failed to process order";
    res.status(500).json({ error: msg });
  }
});

export default router;
