import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { users, orders } from "@workspace/db/schema";
import { getRefCookie } from "../middleware/referral";
import { verifyToken } from "../middleware/auth";
import { logger } from "../lib/logger";
import { redeemPoints, restorePoints } from "../services/loyalty-service";
import { getWalletBalance, debitWallet, creditWallet } from "../services/wallet-service";
import { requireIdempotencyKey } from "../middleware/idempotency";
import bcrypt from "bcryptjs";
import { createStripeClient } from "../lib/stripe-client";
import { stripeCircuit, checkoutComCircuit } from "../lib/circuit-instances";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createCheckoutPaymentLink } from "../lib/checkout-com-client";
import {
  isAllowedRedirectUrl, generateOrderNumber, serializeFulfillmentPayload,
  type StripeFulfillmentPayload,
} from "./checkout-session-helpers";
import { calculateCheckoutTotals } from "./checkout-session-pricing";

export { parseFulfillmentPayload, applyProcessingFee, type ProcessingFeeTier } from "./checkout-session-helpers";

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
  attribution: z.object({
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(100).optional(),
    referrer: z.string().max(300).optional(),
  }).optional(),
});

router.post("/checkout/session", requireIdempotencyKey(), async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, "checkout/session schema validation failed");
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() }); return;
  }

  const { billing, items, coupon, cppSelected, vatNumber, total, giftCards: gcInput, successUrl: clientSuccessUrl, cancelUrl: clientCancelUrl } = parsed.data;

  if (clientSuccessUrl && !isAllowedRedirectUrl(clientSuccessUrl)) { res.status(400).json({ error: "Invalid successUrl: must be on the store domain" }); return; }
  if (clientCancelUrl && !isAllowedRedirectUrl(clientCancelUrl)) { res.status(400).json({ error: "Invalid cancelUrl: must be on the store domain" }); return; }

  let userId: number | undefined;
  let userLocale: string | undefined = parsed.data.locale?.slice(0, 10);
  try {
    const authToken = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (authToken) {
      userId = verifyToken(authToken).userId;
      const [u] = await db.select({ preferredLocale: users.preferredLocale }).from(users).where(eq(users.id, userId)).limit(1);
      if (u?.preferredLocale) userLocale = u.preferredLocale;
    }
  } catch { /* guest checkout */ }

  for (const item of items) {
    if (item.variantId <= 0) {
      if (!item.platform?.startsWith("GIFTCARD|") || item.productId !== -1) { res.status(400).json({ error: "Invalid item in order" }); return; }
      const amt = parseFloat(item.priceUsd);
      if (amt < 5 || amt > 500) { res.status(400).json({ error: "Gift card amount must be $5–$500" }); return; }
    }
  }

  const totalsResult = await calculateCheckoutTotals({ items, billing, coupon, cppSelected, vatNumber, total, giftCards: gcInput, loyaltyPointsUsed: parsed.data.loyaltyPointsUsed, serviceIds: parsed.data.serviceIds, userId });
  if ("error" in totalsResult) { res.status(400).json({ error: totalsResult.error }); return; }

  const { effectivePrices, flashVariantMap, serverCoupon, serverGiftCards, subtotal, discountAmount, loyaltyDisc, loyaltyPtsUsed, loyaltyAccountId, validatedServices, cppAmount, processingFee, taxRate, taxAmount, computedTotal, chargeCurrency } = totalsResult;

  let walletDeduction = 0;
  const reqWallet = parsed.data.walletAmountUsd ?? 0;
  if (reqWallet > 0) {
    if (!userId) { res.status(400).json({ error: "Wallet payment requires login" }); return; }
    const bal = await getWalletBalance(userId);
    walletDeduction = Math.min(reqWallet, bal, computedTotal);
    if (walletDeduction < reqWallet - 0.01) { res.status(400).json({ error: "Insufficient wallet balance" }); return; }
  }

  const cardTotal = Math.max(0, computedTotal - walletDeduction);
  if (cardTotal < 0.50) { res.status(400).json({ error: "Card amount too small for Stripe (minimum $0.50). Use wallet to cover the full amount." }); return; }

  const pricedItems = items.map((it) => {
    if (it.variantId > 0) { const lk = `${it.bundleId ?? "s"}-${it.variantId}`; const sp = effectivePrices.get(lk); if (sp) return { ...it, priceUsd: sp }; }
    return it;
  });

  const orderNumber = generateOrderNumber();
  const walletUsed = walletDeduction > 0;

  const [order] = await db.insert(orders).values({
    orderNumber, guestEmail: billing.email, status: "PENDING",
    subtotalUsd: subtotal.toFixed(2), discountUsd: discountAmount.toFixed(2),
    totalUsd: computedTotal.toFixed(2), paymentMethod: walletUsed ? "MIXED" : "CARD",
    walletAmountUsed: walletUsed ? walletDeduction.toFixed(2) : "0.00",
    userId: userId ?? null, cppSelected: cppSelected ?? false, cppAmountUsd: cppAmount.toFixed(2),
    taxRate: taxRate.toFixed(2), taxAmountUsd: taxAmount.toFixed(2),
    vatNumber: vatNumber ?? null, billingSnapshot: billing,
    couponId: serverCoupon?.id ?? null,
    couponCode: serverCoupon?.code ?? null,
    attribution: parsed.data.attribution ?? null,
  }).returning({ id: orders.id });

  let loyaltyRedeemed = false;
  let walletDebited = false;

  try {
    if (loyaltyPtsUsed > 0 && userId && loyaltyAccountId) {
      await redeemPoints(loyaltyAccountId, loyaltyPtsUsed, order.id);
      loyaltyRedeemed = true;
    }
    if (walletUsed && userId) {
      await debitWallet(userId, walletDeduction, "PURCHASE", `Order ${orderNumber}`, `order:${order.id}`);
      walletDebited = true;
    }

    const payload: StripeFulfillmentPayload = {
      billing, items: pricedItems, giftCards: serverGiftCards,
      flashVariantMap: Array.from(flashVariantMap.entries()),
      affiliateRefCode: getRefCookie(req), loyaltyPointsUsed: loyaltyPtsUsed || undefined,
      loyaltyAccountId, services: validatedServices,
      guestPasswordHash: parsed.data.guestPassword ? await bcrypt.hash(parsed.data.guestPassword, 12) : undefined,
      locale: userLocale, total: computedTotal,
      clientIp: (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim(),
    };
    await db.update(orders).set({ notes: serializeFulfillmentPayload(payload) }).where(eq(orders.id, order.id));

    const paymentConfig = await getActivePaymentConfig();
    if (!paymentConfig) { res.status(503).json({ error: "No payment provider is configured. Please contact support." }); return; }

    const storeUrl = process.env.STORE_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? "http://localhost:18539";
    const successUrl = clientSuccessUrl?.replace("{ORDER_NUMBER}", orderNumber) ?? `${storeUrl}/order-complete/${orderNumber}`;
    const cancelUrl = clientCancelUrl ?? `${storeUrl}/checkout`;
    const description = walletUsed ? `PixelCodes Order #${orderNumber} (incl. $${walletDeduction.toFixed(2)} wallet credit)` : `PixelCodes Order #${orderNumber}`;

    let redirectUrl: string;
    if (paymentConfig.provider === "stripe") {
      const stripe = createStripeClient(paymentConfig.secretKey);
      const session = await stripeCircuit.exec(
        async () => stripe.checkout.sessions.create({
          mode: "payment", customer_email: billing.email,
          payment_method_types: ["card"],
          line_items: [{ price_data: { currency: chargeCurrency, product_data: { name: description }, unit_amount: Math.round(cardTotal * 100) }, quantity: 1 }],
          metadata: { orderId: String(order.id), orderNumber },
          payment_intent_data: { metadata: { orderId: String(order.id), orderNumber } },
          payment_method_options: { card: { request_three_d_secure: "any" } },
          success_url: successUrl, cancel_url: cancelUrl,
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
          { amountCents: Math.round(cardTotal * 100), currency: chargeCurrency.toUpperCase(), reference: orderNumber, description, customerEmail: billing.email, customerName: `${billing.firstName} ${billing.lastName}`, successUrl, failureUrl: cancelUrl, expiresAt: new Date(Date.now() + 30 * 60 * 1000), metadata: { orderId: String(order.id), orderNumber } },
        ),
        async () => { throw new Error("Payment processing temporarily unavailable, please try again shortly"); },
      );
      logger.info({ orderNumber, linkId: link.id, cardTotal }, "Checkout.com payment link created");
      redirectUrl = link.redirectUrl;
    } else {
      res.status(503).json({ error: "Unsupported payment provider" }); return;
    }

    res.status(201).json({ url: redirectUrl, orderNumber });
  } catch (err) {
    if (walletDebited && userId) {
      await creditWallet(userId, walletDeduction, "REFUND", `Reversed: ${orderNumber} session failed`, `reversal:${order.id}`).catch((e) => {
        logger.error({ err: e, orderId: order.id }, "Failed to refund wallet on checkout session failure");
      });
    }
    if (loyaltyRedeemed && loyaltyAccountId && loyaltyPtsUsed) {
      await restorePoints(loyaltyAccountId, loyaltyPtsUsed, `Points restored: ${orderNumber} session failed`, order.id).catch((e) => {
        logger.error({ err: e, orderId: order.id }, "Failed to restore loyalty points on checkout session failure");
      });
    }
    await db.update(orders).set({ status: "FAILED", notes: null, updatedAt: new Date() }).where(eq(orders.id, order.id));
    logger.error({ err, orderNumber }, "Failed to create Stripe checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
