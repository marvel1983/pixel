import { Router } from "express";
import { z } from "zod";
import { inArray, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants, taxSettings, taxRates, checkoutServices, users, orders, siteSettings } from "@workspace/db/schema";
import { validateCouponServerSide } from "../services/coupon-service";
import { validateGiftCards, loadGiftCardBalances } from "../services/gift-card-service";
import { loadBundlePriceMap } from "../services/bundle-pricing";
import { getFlashSaleInfo } from "../services/flash-sale-pricing";
import { getBulkDiscount } from "../services/bulk-pricing-service";
import { getRefCookie } from "../middleware/referral";
import { verifyToken } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getLoyaltyConfig, getOrCreateAccount, pointsToDiscount, redeemPoints, restorePoints } from "../services/loyalty-service";
import { getWalletBalance, debitWallet, creditWallet } from "../services/wallet-service";
import { requireIdempotencyKey } from "../middleware/idempotency";
import bcrypt from "bcryptjs";
import { createStripeClient } from "../lib/stripe-client";
import { stripeCircuit, checkoutComCircuit } from "../lib/circuit-instances";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createCheckoutPaymentLink } from "../lib/checkout-com-client";

const router = Router();

const currencyStr = z.string().regex(/^\d+(\.\d{1,2})?$/);
const s1 = z.string().min(1);

const billingSchema = z.object({
  email: z.string().email(), firstName: s1, lastName: s1,
  country: s1, city: z.string().default(""), address: z.string().default(""), zip: z.string().default(""),
  phone: z.string().trim().min(5).max(40),
});

const itemSchema = z.object({
  variantId: z.number().int(), productId: z.number().int(),
  productName: s1, variantName: s1, imageUrl: z.string().nullish(),
  priceUsd: currencyStr, quantity: z.number().int().positive().max(99),
  platform: z.string().nullish(), bundleId: z.number().int().optional(),
});

const sessionSchema = z.object({
  billing: billingSchema,
  items: z.array(itemSchema).min(1).max(50),
  coupon: z.object({ code: z.string().min(1).max(50), pct: z.number(), label: z.string() }).nullable().optional(),
  cppSelected: z.boolean().optional(),
  vatNumber: z.string().max(50).optional(),
  total: currencyStr,
  walletAmountUsd: z.number().min(0).optional(),
  guestPassword: z.string().min(8).optional(),
  giftCards: z.array(z.object({ code: z.string(), amount: z.number().positive() })).optional(),
  loyaltyPointsUsed: z.number().int().min(0).optional(),
  serviceIds: z.array(z.number().int().positive()).max(10).optional(),
  locale: z.string().max(10).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// CPP_RATE retained for legacy reference only — actual amount now comes from siteSettings.cppPrice
const generateOrderNumber = () =>
  `PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

function isAllowedRedirectUrl(url: string): boolean {
  try {
    const { origin } = new URL(url);
    const storeUrl = process.env.STORE_PUBLIC_URL ?? process.env.APP_PUBLIC_URL;
    if (storeUrl) {
      const allowedOrigin = new URL(storeUrl).origin;
      return origin === allowedOrigin;
    }
    // No env var configured — only allow HTTPS (blocks plain HTTP phishing pages)
    return url.startsWith("https://");
  } catch {
    return false;
  }
}

// Serializable fulfillment payload stored in order.notes for webhook retrieval
interface StripeFulfillmentPayload {
  billing: z.infer<typeof billingSchema>;
  items: z.infer<typeof itemSchema>[];
  giftCards: Array<{ code: string; amount: number }>;
  flashVariantMap: Array<[number, number]>; // Map serialized as entries
  affiliateRefCode: string | undefined;
  loyaltyPointsUsed: number | undefined;
  loyaltyAccountId: number | undefined;
  services: Array<{ id: number; name: string; priceUsd: string }>;
  guestPasswordHash: string | undefined;
  locale: string | undefined;
  total: number;
}

export function serializeFulfillmentPayload(payload: StripeFulfillmentPayload): string {
  return `__stripe_payload:${JSON.stringify(payload)}`;
}

export function parseFulfillmentPayload(notes: string | null): StripeFulfillmentPayload | null {
  if (!notes?.startsWith("__stripe_payload:")) return null;
  try {
    return JSON.parse(notes.slice("__stripe_payload:".length)) as StripeFulfillmentPayload;
  } catch {
    return null;
  }
}

router.post("/checkout/session", requireIdempotencyKey(), async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })) }, "checkout/session schema validation failed");
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { billing, items, coupon, cppSelected, vatNumber, total, giftCards: gcInput, successUrl: clientSuccessUrl, cancelUrl: clientCancelUrl } = parsed.data;

  if (clientSuccessUrl && !isAllowedRedirectUrl(clientSuccessUrl)) {
    res.status(400).json({ error: "Invalid successUrl: must be on the store domain" });
    return;
  }
  if (clientCancelUrl && !isAllowedRedirectUrl(clientCancelUrl)) {
    res.status(400).json({ error: "Invalid cancelUrl: must be on the store domain" });
    return;
  }
  let userId: number | undefined;
  let userLocale: string | undefined = parsed.data.locale?.slice(0, 10);

  try {
    const authToken = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (authToken) {
      userId = verifyToken(authToken).userId;
      const [u] = await db.select({ preferredLocale: users.preferredLocale }).from(users)
        .where(eq(users.id, userId)).limit(1);
      if (u?.preferredLocale) userLocale = u.preferredLocale;
    }
  } catch { /* guest checkout */ }

  // --- Gift card item validation ---
  for (const item of items) {
    if (item.variantId <= 0) {
      if (!item.platform?.startsWith("GIFTCARD|") || item.productId !== -1) {
        res.status(400).json({ error: "Invalid item in order" }); return;
      }
      const amt = parseFloat(item.priceUsd);
      if (amt < 5 || amt > 500) { res.status(400).json({ error: "Gift card amount must be $5–$500" }); return; }
    }
  }

  // --- Price validation (same logic as orders.ts) ---
  const variantIds = items.filter((i) => i.variantId > 0).map((i) => i.variantId);
  const dbVariants = variantIds.length
    ? await db.select({ id: productVariants.id, priceUsd: productVariants.priceUsd, priceOverrideUsd: productVariants.priceOverrideUsd, productId: productVariants.productId })
        .from(productVariants).where(inArray(productVariants.id, variantIds))
    : [];

  const variantMap = new Map(dbVariants.map((v) => [v.id, v]));
  if (dbVariants.length !== variantIds.length) {
    const missing = variantIds.filter((id) => !variantMap.has(id));
    res.status(400).json({ error: `Variant(s) not found: ${missing.join(", ")}` }); return;
  }

  const { priceMap: bundlePriceMap } = await loadBundlePriceMap(items);
  const flashInfo = await getFlashSaleInfo(variantIds);
  const flashVariantMap = new Map<number, number>();
  const flashQtyAgg = new Map<number, number>();
  const effectivePrices = new Map<string, string>();

  for (const item of items) {
    const lineKey = `${item.bundleId ?? "s"}-${item.variantId}`;
    if (item.bundleId) {
      const bundleKey = `${item.bundleId}-${item.variantId}`;
      const serverBundlePrice = bundlePriceMap.get(bundleKey);
      if (!serverBundlePrice) { res.status(400).json({ error: `Bundle pricing not found for ${item.productName}` }); return; }
      if (Math.abs(parseFloat(serverBundlePrice) - parseFloat(item.priceUsd)) > 0.02) {
        res.status(400).json({ error: `Bundle price changed for ${item.productName}` }); return;
      }
      effectivePrices.set(lineKey, serverBundlePrice);
      continue;
    }
    if (item.variantId <= 0) continue; // gift card

    const dbVariant = variantMap.get(item.variantId);
    const basePrice = dbVariant?.priceOverrideUsd
      ? parseFloat(dbVariant.priceOverrideUsd)
      : parseFloat(dbVariant?.priceUsd ?? item.priceUsd);

    const fi = flashInfo.get(item.variantId);
    if (fi) {
      const totalQty = (flashQtyAgg.get(item.variantId) ?? 0) + item.quantity;
      flashQtyAgg.set(item.variantId, totalQty);
      if (totalQty > fi.maxQuantity - fi.soldCount) {
        res.status(400).json({ error: `Only ${fi.maxQuantity - fi.soldCount} left in flash sale for ${item.productName}` }); return;
      }
      flashVariantMap.set(item.variantId, fi.flashSaleId);
      effectivePrices.set(lineKey, fi.salePriceUsd);
    } else {
      let effectivePrice = basePrice;
      const productIdForBulk = dbVariant?.productId ?? item.productId;
      const bulkDiscountPct = await getBulkDiscount(productIdForBulk, item.quantity);
      if (bulkDiscountPct > 0) {
        effectivePrice = Math.round(effectivePrice * (1 - bulkDiscountPct / 100) * 100) / 100;
      }
      if (Math.abs(effectivePrice - parseFloat(item.priceUsd)) > 0.02) {
        res.status(400).json({ error: `Price changed for ${item.productName}` }); return;
      }
      effectivePrices.set(lineKey, effectivePrice.toFixed(2));
    }
  }

  // --- Coupon ---
  let serverCoupon: Awaited<ReturnType<typeof validateCouponServerSide>> = null;
  if (coupon?.code) {
    serverCoupon = await validateCouponServerSide(coupon.code);
    if (!serverCoupon) { res.status(400).json({ error: "Invalid or expired coupon code" }); return; }
  }

  // --- Gift cards ---
  let serverGiftCards: Array<{ code: string; amount: number }> = [];
  if (gcInput?.length) {
    const deduped = new Map<string, number>();
    for (const gc of gcInput) deduped.set(gc.code.trim().toUpperCase(), (deduped.get(gc.code.trim().toUpperCase()) ?? 0) + gc.amount);
    const dedupedList = Array.from(deduped, ([code, amount]) => ({ code, amount }));
    const gcResult = await validateGiftCards(dedupedList);
    if (!gcResult.valid) { res.status(400).json({ error: gcResult.error }); return; }
    const balances = await loadGiftCardBalances(dedupedList.map((g) => g.code));
    serverGiftCards = dedupedList.map((gc) => ({ code: gc.code, amount: Math.min(gc.amount, balances.get(gc.code) ?? 0) }));
  }

  // --- Subtotal ---
  const subtotal = items.reduce((sum, it) => {
    const lk = `${it.bundleId ?? "s"}-${it.variantId}`;
    const price = it.variantId > 0 ? (effectivePrices.get(lk) ?? it.priceUsd) : it.priceUsd;
    return sum + parseFloat(price) * it.quantity;
  }, 0);

  if (serverCoupon?.minOrderUsd && subtotal < serverCoupon.minOrderUsd) {
    res.status(400).json({ error: `Coupon requires a minimum order of $${serverCoupon.minOrderUsd.toFixed(2)}` }); return;
  }

  // --- Discounts ---
  let couponDiscount = 0;
  if (serverCoupon) {
    if (serverCoupon.type === "FIXED") {
      couponDiscount = Math.min(serverCoupon.amount, subtotal);
    } else {
      couponDiscount = subtotal * (serverCoupon.pct / 100);
      if (serverCoupon.maxDiscountUsd && couponDiscount > serverCoupon.maxDiscountUsd) {
        couponDiscount = serverCoupon.maxDiscountUsd;
      }
    }
  }

  let loyaltyDisc = 0, loyaltyPtsUsed = 0, loyaltyAccountId: number | undefined;
  const reqPts = parsed.data.loyaltyPointsUsed ?? 0;
  if (reqPts > 0 && userId) {
    const lc = await getLoyaltyConfig();
    if (lc?.enabled) {
      const acc = await getOrCreateAccount(userId);
      loyaltyAccountId = acc.id;
      if (reqPts >= lc.minRedeemPoints && reqPts <= acc.pointsBalance) {
        const raw = pointsToDiscount(reqPts, lc);
        const max = subtotal * (lc.maxRedeemPercent / 100);
        loyaltyDisc = Math.min(raw, max);
        loyaltyPtsUsed = loyaltyDisc < raw ? Math.ceil(loyaltyDisc / parseFloat(lc.redemptionRate)) : reqPts;
      }
    }
  }

  // --- Services ---
  let servicesAmount = 0;
  let validatedServices: Array<{ id: number; name: string; priceUsd: string }> = [];
  const dedupedServiceIds = [...new Set(parsed.data.serviceIds ?? [])];
  if (dedupedServiceIds.length) {
    const dbServices = await db.select().from(checkoutServices).where(inArray(checkoutServices.id, dedupedServiceIds));
    const enabledServices = dbServices.filter((s) => s.enabled);
    if (enabledServices.length !== dedupedServiceIds.length) {
      res.status(400).json({ error: "One or more selected services are unavailable" }); return;
    }
    validatedServices = enabledServices.map((s) => ({ id: s.id, name: s.name, priceUsd: s.priceUsd }));
    servicesAmount = enabledServices.reduce((s, svc) => s + parseFloat(svc.priceUsd), 0);
  }

  // --- Fees from settings ---
  const [feeSettings] = await db.select({
    cppPrice: siteSettings.cppPrice,
    processingFeePercent: siteSettings.processingFeePercent,
    processingFeeFixed: siteSettings.processingFeeFixed,
    defaultCurrency: siteSettings.defaultCurrency,
  }).from(siteSettings);
  // Stripe/Checkout.com currency follows the admin default (lowercase for Stripe)
  const chargeCurrency = (feeSettings?.defaultCurrency ?? "EUR").toLowerCase();
  const discountAmount = couponDiscount + loyaltyDisc;
  const cppAmount = cppSelected ? (Number(feeSettings?.cppPrice) || 0) : 0;
  const feeBase = subtotal - discountAmount + cppAmount + servicesAmount;
  const processingFee = Math.round(
    (feeBase * (Number(feeSettings?.processingFeePercent) || 0) / 100 + (Number(feeSettings?.processingFeeFixed) || 0)) * 100,
  ) / 100;

  let taxRate = 0, taxAmount = 0;
  const [taxConfig] = await db.select().from(taxSettings);
  if (taxConfig?.enabled) {
    const vatValid = vatNumber && vatNumber.trim().length >= 8 && /^[A-Z]{2}\d{5,}/.test(vatNumber.trim().toUpperCase());
    if (!(taxConfig.b2bExemptionEnabled && vatValid)) {
      taxRate = parseFloat(taxConfig.defaultRate);
      const country = billing.country.toUpperCase();
      const [cr] = await db.select().from(taxRates).where(eq(taxRates.countryCode, country));
      if (cr?.isEnabled) taxRate = parseFloat(cr.rate);
      const beforeTax = feeBase + processingFee;
      if (taxConfig.priceDisplay === "inclusive") {
        taxAmount = Math.round((beforeTax - beforeTax / (1 + taxRate / 100)) * 100) / 100;
      } else {
        taxAmount = Math.round(beforeTax * (taxRate / 100) * 100) / 100;
      }
    }
  }

  // --- Total verification ---
  const isInclusive = taxConfig?.priceDisplay === "inclusive";
  const preGcTotal = isInclusive
    ? feeBase + processingFee
    : feeBase + processingFee + taxAmount;
  const gcDeduction = serverGiftCards.reduce((s, c) => s + c.amount, 0);
  if (gcDeduction > preGcTotal + 0.01) {
    res.status(400).json({ error: "Gift card amount exceeds order total" }); return;
  }
  const computedTotal = Math.max(0, preGcTotal - gcDeduction);
  if (Math.abs(computedTotal - parseFloat(total)) > 0.02) {
    res.status(400).json({ error: "Total mismatch. Please refresh and try again." }); return;
  }

  // --- Wallet ---
  let walletDeduction = 0;
  const reqWallet = parsed.data.walletAmountUsd ?? 0;
  if (reqWallet > 0) {
    if (!userId) { res.status(400).json({ error: "Wallet payment requires login" }); return; }
    const bal = await getWalletBalance(userId);
    walletDeduction = Math.min(reqWallet, bal, computedTotal);
    if (walletDeduction < reqWallet - 0.01) {
      res.status(400).json({ error: "Insufficient wallet balance" }); return;
    }
  }

  const cardTotal = Math.max(0, computedTotal - walletDeduction);
  if (cardTotal < 0.50) {
    res.status(400).json({ error: "Card amount too small for Stripe (minimum $0.50). Use wallet to cover the full amount." });
    return;
  }

  // --- Priced items ---
  const pricedItems = items.map((it) => {
    if (it.variantId > 0) {
      const lk = `${it.bundleId ?? "s"}-${it.variantId}`;
      const sp = effectivePrices.get(lk);
      if (sp) return { ...it, priceUsd: sp };
    }
    return it;
  });

  const orderNumber = generateOrderNumber();
  const walletUsed = walletDeduction > 0;
  const payMethod = walletUsed ? "MIXED" : "CARD";

  // --- Create pending order ---
  const [order] = await db.insert(orders).values({
    orderNumber,
    guestEmail: billing.email,
    status: "PENDING",
    subtotalUsd: subtotal.toFixed(2),
    discountUsd: discountAmount.toFixed(2),
    totalUsd: computedTotal.toFixed(2),
    paymentMethod: payMethod,
    walletAmountUsed: walletUsed ? walletDeduction.toFixed(2) : "0.00",
    userId: userId ?? null,
    cppSelected: cppSelected ?? false,
    cppAmountUsd: cppAmount.toFixed(2),
    taxRate: taxRate.toFixed(2),
    taxAmountUsd: taxAmount.toFixed(2),
    vatNumber: vatNumber ?? null,
  }).returning({ id: orders.id });

  let loyaltyRedeemed = false;
  let walletDebited = false;

  try {
    // Redeem loyalty points before payment
    if (loyaltyPtsUsed > 0 && userId && loyaltyAccountId) {
      await redeemPoints(loyaltyAccountId, loyaltyPtsUsed, order.id);
      loyaltyRedeemed = true;
    }

    // Debit wallet for mixed payments
    if (walletUsed && userId) {
      await debitWallet(userId, walletDeduction, "PURCHASE", `Order ${orderNumber}`, `order:${order.id}`);
      walletDebited = true;
    }

    // Store fulfillment payload in notes for webhook retrieval
    const payload: StripeFulfillmentPayload = {
      billing,
      items: pricedItems,
      giftCards: serverGiftCards,
      flashVariantMap: Array.from(flashVariantMap.entries()),
      affiliateRefCode: getRefCookie(req),
      loyaltyPointsUsed: loyaltyPtsUsed || undefined,
      loyaltyAccountId,
      services: validatedServices,
      guestPasswordHash: parsed.data.guestPassword
        ? await bcrypt.hash(parsed.data.guestPassword, 12)
        : undefined,
      locale: userLocale,
      total: computedTotal,
    };
    await db.update(orders)
      .set({ notes: serializeFulfillmentPayload(payload) })
      .where(eq(orders.id, order.id));

    // Create hosted payment session with the active provider
    const paymentConfig = await getActivePaymentConfig();
    if (!paymentConfig) {
      res.status(503).json({ error: "No payment provider is configured. Please contact support." });
      return;
    }

    const storeUrl = process.env.STORE_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? "http://localhost:18539";
    const successUrl = clientSuccessUrl?.replace("{ORDER_NUMBER}", orderNumber) ?? `${storeUrl}/order-complete/${orderNumber}`;
    const cancelUrl = clientCancelUrl ?? `${storeUrl}/checkout`;

    const description = walletUsed
      ? `PixelCodes Order #${orderNumber} (incl. $${walletDeduction.toFixed(2)} wallet credit)`
      : `PixelCodes Order #${orderNumber}`;

    let redirectUrl: string;

    if (paymentConfig.provider === "stripe") {
      const stripe = createStripeClient(paymentConfig.secretKey);
      const session = await stripeCircuit.exec(
        async () => stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: billing.email,
          line_items: [{
            price_data: {
              currency: chargeCurrency,
              product_data: { name: description },
              unit_amount: Math.round(cardTotal * 100),
            },
            quantity: 1,
          }],
          metadata: { orderId: String(order.id), orderNumber },
          payment_intent_data: { metadata: { orderId: String(order.id), orderNumber } },
          success_url: successUrl,
          cancel_url: cancelUrl,
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        }),
        async () => { throw new Error("Payment processing temporarily unavailable, please try again shortly"); },
      );
      logger.info({ orderNumber, sessionId: session.id, cardTotal }, "Stripe checkout session created");
      redirectUrl = session.url!;
    } else if (paymentConfig.provider === "checkout") {
      const link = await checkoutComCircuit.exec(
        async () => createCheckoutPaymentLink(
          { secretKey: paymentConfig.secretKey, mode: paymentConfig.mode },
          {
            amountCents: Math.round(cardTotal * 100),
            currency: chargeCurrency.toUpperCase(),
            reference: orderNumber,
            description,
            customerEmail: billing.email,
            customerName: `${billing.firstName} ${billing.lastName}`,
            successUrl,
            failureUrl: cancelUrl,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            metadata: { orderId: String(order.id), orderNumber },
          },
        ),
        async () => { throw new Error("Payment processing temporarily unavailable, please try again shortly"); },
      );
      logger.info({ orderNumber, linkId: link.id, cardTotal }, "Checkout.com payment link created");
      redirectUrl = link.redirectUrl;
    } else {
      res.status(503).json({ error: "Unsupported payment provider" });
      return;
    }

    res.status(201).json({ url: redirectUrl, orderNumber });
  } catch (err) {
    // Rollback pre-payment side effects
    if (walletDebited && userId) {
      await creditWallet(userId, walletDeduction, "REFUND", `Reversed: ${orderNumber} session failed`, `reversal:${order.id}`).catch(() => {});
    }
    if (loyaltyRedeemed && loyaltyAccountId && loyaltyPtsUsed) {
      await restorePoints(loyaltyAccountId, loyaltyPtsUsed, `Points restored: ${orderNumber} session failed`, order.id).catch(() => {});
    }
    await db.update(orders).set({ status: "FAILED", notes: null, updatedAt: new Date() }).where(eq(orders.id, order.id));
    logger.error({ err, orderNumber }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to create checkout session" });
  }
});

export default router;
