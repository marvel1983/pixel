import { Router } from "express";
import { z } from "zod";
import { inArray, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants, taxSettings, taxRates } from "@workspace/db/schema";
import { executeOrderPipeline } from "../services/order-pipeline";
import { validateCouponServerSide } from "../services/coupon-service";
import { validateGiftCards, loadGiftCardBalances } from "../services/gift-card-service";
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
  variantId: z.number().int(),
  productId: z.number().int(),
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
  vatNumber: z.string().max(50).optional(),
  total: currencyStr,
  payment: z.object({ cardToken: z.string().min(1) }),
  guestPassword: z.string().min(8).optional(),
  giftCards: z.array(z.object({
    code: z.string(),
    amount: z.number().positive(),
  })).optional(),
});

const CPP_RATE = 0.05;

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PC-${ts}-${rand}`;
}

async function validateAndPriceItems(items: z.infer<typeof orderSchema>["items"]) {
  const variantIds = items.filter((i) => i.variantId > 0).map((i) => i.variantId);
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

  const { billing, items, coupon, cppSelected, vatNumber, total, payment, giftCards: gcInput } = parsed.data;

  for (const item of items) {
    if (item.variantId <= 0) {
      if (!item.platform?.startsWith("GIFTCARD|") || item.productId !== -1) {
        res.status(400).json({ error: "Invalid item in order" }); return;
      }
      const amt = parseFloat(item.priceUsd);
      if (amt < 5 || amt > 500) {
        res.status(400).json({ error: "Gift card amount must be $5–$500" }); return;
      }
    }
  }

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

  let serverGiftCards: Array<{ code: string; amount: number }> = [];
  if (gcInput?.length) {
    const deduped = new Map<string, number>();
    for (const gc of gcInput) {
      const code = gc.code.trim().toUpperCase();
      deduped.set(code, (deduped.get(code) ?? 0) + gc.amount);
    }
    const dedupedList = Array.from(deduped, ([code, amount]) => ({ code, amount }));
    const gcResult = await validateGiftCards(dedupedList);
    if (!gcResult.valid) { res.status(400).json({ error: gcResult.error }); return; }
    const balances = await loadGiftCardBalances(dedupedList.map((g) => g.code));
    serverGiftCards = dedupedList.map((gc) => ({
      code: gc.code,
      amount: Math.min(gc.amount, balances.get(gc.code) ?? 0),
    }));
  }

  const subtotal = items.reduce(
    (sum, it) => sum + parseFloat(it.priceUsd) * it.quantity,
    0,
  );
  const discountPct = serverCoupon?.pct ?? 0;
  const discountAmount = subtotal * (discountPct / 100);
  const cppAmount = cppSelected ? Math.round(subtotal * CPP_RATE * 100) / 100 : 0;

  let taxRate = 0;
  let taxAmount = 0;
  const [taxConfig] = await db.select().from(taxSettings);
  if (taxConfig?.enabled) {
    const vatValid = vatNumber && vatNumber.trim().length >= 8 && /^[A-Z]{2}\d{5,}/.test(vatNumber.trim().toUpperCase());
    const isExempt = taxConfig.b2bExemptionEnabled && vatValid;
    if (!isExempt) {
      taxRate = parseFloat(taxConfig.defaultRate);
      const country = billing.country.toUpperCase();
      const [cr] = await db.select().from(taxRates).where(eq(taxRates.countryCode, country));
      if (cr?.isEnabled) taxRate = parseFloat(cr.rate);
      const beforeTax = subtotal - discountAmount + cppAmount;
      if (taxConfig.priceDisplay === "inclusive") {
        taxAmount = Math.round((beforeTax - beforeTax / (1 + taxRate / 100)) * 100) / 100;
      } else {
        taxAmount = Math.round(beforeTax * (taxRate / 100) * 100) / 100;
      }
    }
  }

  const isInclusive = taxConfig?.priceDisplay === "inclusive";
  const preGcTotal = isInclusive ? subtotal - discountAmount + cppAmount : subtotal - discountAmount + cppAmount + taxAmount;
  const gcDeduction = serverGiftCards.reduce((s, c) => s + c.amount, 0);
  if (gcDeduction > preGcTotal + 0.01) {
    res.status(400).json({ error: "Gift card amount exceeds order total" });
    return;
  }
  const computedTotal = Math.max(0, preGcTotal - gcDeduction);

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
      taxRate,
      taxAmount,
      vatNumber: vatNumber ?? null,
      total: computedTotal,
      orderNumber: generateOrderNumber(),
      cardToken: payment.cardToken,
      guestPassword: parsed.data.guestPassword,
      giftCards: serverGiftCards,
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
