import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { taxSettings, taxRates, checkoutServices, users, siteSettings } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";
import { executeOrderPipeline } from "../services/order-pipeline";
import { validateCouponServerSide } from "../services/coupon-service";
import { validateGiftCards, loadGiftCardBalances } from "../services/gift-card-service";
import { getRefCookie } from "../middleware/referral";
import { verifyToken } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getLoyaltyConfig, getOrCreateAccount, pointsToDiscount } from "../services/loyalty-service";
import { getWalletBalance } from "../services/wallet-service";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { checkoutLimit } from "../middleware/rate-limit";
import { validateAndPriceItems } from "./orders-pricing";

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
const orderSchema = z.object({
  billing: billingSchema,
  items: z.array(itemSchema).min(1).max(50),
  coupon: z.object({ code: z.string().min(1).max(50), pct: z.number(), label: z.string() }).nullable().optional(),
  cppSelected: z.boolean().optional(),
  vatNumber: z.string().max(50).optional(), total: currencyStr,
  paymentMethod: z.enum(["card", "net30"]).optional(),
  walletAmountUsd: z.number().min(0).optional(),
  guestPassword: z.string().min(8).optional(),
  giftCards: z.array(z.object({ code: z.string(), amount: z.number().positive() })).optional(),
  loyaltyPointsUsed: z.number().int().min(0).optional(),
  serviceIds: z.array(z.number().int().positive()).max(10).optional(),
  locale: z.string().max(10).optional(),
  attribution: z.object({
    utm_source: z.string().max(100).optional(),
    utm_medium: z.string().max(100).optional(),
    utm_campaign: z.string().max(100).optional(),
    referrer: z.string().max(300).optional(),
  }).optional(),
});

const generateOrderNumber = () => `PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

router.post("/orders", checkoutLimit, requireIdempotencyKey(), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, "orders schema validation failed");
    res.status(400).json({ error: "Invalid order data", details: parsed.error.flatten() }); return;
  }
  const { billing, items, coupon, cppSelected, vatNumber, total, giftCards: gcInput } = parsed.data;
  let userId: number | undefined;
  let userLocale: string | undefined;
  if (typeof parsed.data.locale === "string") userLocale = parsed.data.locale.slice(0, 10);
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

  const { error: priceError, flashVariantMap, prices: serverPrices } = await validateAndPriceItems(items);
  if (priceError) { res.status(400).json({ error: priceError }); return; }

  let serverCoupon: Awaited<ReturnType<typeof validateCouponServerSide>> = null;
  if (coupon?.code) {
    serverCoupon = await validateCouponServerSide(coupon.code);
    if (!serverCoupon) { res.status(400).json({ error: "Invalid or expired coupon code" }); return; }
  }

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

  const subtotal = items.reduce((sum, it) => {
    const lk = `${it.bundleId ?? "s"}-${it.variantId}`;
    const price = (serverPrices && it.variantId > 0) ? serverPrices.get(lk) ?? it.priceUsd : it.priceUsd;
    return sum + parseFloat(price) * it.quantity;
  }, 0);

  if (serverCoupon?.minOrderUsd && subtotal < serverCoupon.minOrderUsd) {
    res.status(400).json({ error: `Coupon requires a minimum order of $${serverCoupon.minOrderUsd.toFixed(2)}` }); return;
  }

  let couponDiscount = 0;
  if (serverCoupon) {
    let eligibleSubtotal = subtotal;
    if (serverCoupon.productIds && serverCoupon.productIds.length > 0) {
      const eligible = new Set(serverCoupon.productIds);
      eligibleSubtotal = items.reduce((sum, it) => {
        if (!eligible.has(it.productId)) return sum;
        const lk = `${it.bundleId ?? "s"}-${it.variantId}`;
        const price = (serverPrices && it.variantId > 0) ? serverPrices.get(lk) ?? it.priceUsd : it.priceUsd;
        return sum + parseFloat(price) * it.quantity;
      }, 0);
      if (eligibleSubtotal === 0) { res.status(400).json({ error: "This coupon is not valid for the items in your cart." }); return; }
    }
    if (serverCoupon.type === "FIXED") {
      couponDiscount = Math.min(serverCoupon.amount, eligibleSubtotal);
    } else {
      couponDiscount = eligibleSubtotal * (serverCoupon.pct / 100);
      if (serverCoupon.maxDiscountUsd && couponDiscount > serverCoupon.maxDiscountUsd) {
        couponDiscount = serverCoupon.maxDiscountUsd;
      }
    }
  }

  let loyaltyDisc = 0, loyaltyPtsUsed = 0;
  const reqPts = parsed.data.loyaltyPointsUsed ?? 0;
  if (reqPts > 0 && userId) {
    const lc = await getLoyaltyConfig();
    if (lc?.enabled) {
      const acc = await getOrCreateAccount(userId);
      if (reqPts >= lc.minRedeemPoints && reqPts <= acc.pointsBalance) {
        const raw = pointsToDiscount(reqPts, lc);
        const max = subtotal * (lc.maxRedeemPercent / 100);
        loyaltyDisc = Math.min(raw, max);
        loyaltyPtsUsed = loyaltyDisc < raw ? Math.ceil(loyaltyDisc / parseFloat(lc.redemptionRate)) : reqPts;
      }
    }
  }

  let servicesAmount = 0;
  let validatedServices: Array<{ id: number; name: string; priceUsd: string }> = [];
  const dedupedServiceIds = [...new Set(parsed.data.serviceIds ?? [])];
  if (dedupedServiceIds.length) {
    const dbServices = await db.select().from(checkoutServices).where(inArray(checkoutServices.id, dedupedServiceIds));
    const enabledServices = dbServices.filter((s) => s.enabled);
    if (enabledServices.length !== dedupedServiceIds.length) { res.status(400).json({ error: "One or more selected services are unavailable" }); return; }
    validatedServices = enabledServices.map((s) => ({ id: s.id, name: s.name, priceUsd: s.priceUsd }));
    servicesAmount = enabledServices.reduce((s, svc) => s + parseFloat(svc.priceUsd), 0);
  }

  const [feeSettings] = await db.select({ cppPrice: siteSettings.cppPrice, processingFeePercent: siteSettings.processingFeePercent, processingFeeFixed: siteSettings.processingFeeFixed }).from(siteSettings);
  const discountAmount = couponDiscount + loyaltyDisc;
  const cppAmount = cppSelected ? (Number(feeSettings?.cppPrice) || 0) : 0;
  const feeBase = subtotal - discountAmount + cppAmount + servicesAmount;
  const processingFee = Math.round((feeBase * (Number(feeSettings?.processingFeePercent) || 0) / 100 + (Number(feeSettings?.processingFeeFixed) || 0)) * 100) / 100;

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
      const beforeTax = feeBase + processingFee;
      if (taxConfig.priceDisplay === "inclusive") {
        taxAmount = Math.round((beforeTax - beforeTax / (1 + taxRate / 100)) * 100) / 100;
      } else {
        taxAmount = Math.round(beforeTax * (taxRate / 100) * 100) / 100;
      }
    }
  }

  const isInclusive = taxConfig?.priceDisplay === "inclusive";
  const preGcTotal = isInclusive ? feeBase + processingFee : feeBase + processingFee + taxAmount;
  const gcDeduction = serverGiftCards.reduce((s, c) => s + c.amount, 0);
  if (gcDeduction > preGcTotal + 0.01) { res.status(400).json({ error: "Gift card amount exceeds order total" }); return; }
  const computedTotal = Math.max(0, preGcTotal - gcDeduction);

  if (Math.abs(computedTotal - parseFloat(total)) > 0.005) {
    logger.warn({
      clientTotal: total, serverTotal: computedTotal.toFixed(4), subtotal: subtotal.toFixed(4),
      feeBase: feeBase.toFixed(4), processingFee: processingFee.toFixed(4), taxAmount: taxAmount.toFixed(4),
      gcDeduction: gcDeduction.toFixed(4), discountAmount: discountAmount.toFixed(4), cppAmount: cppAmount.toFixed(4),
      items: items.map((i) => ({ variantId: i.variantId, priceUsd: i.priceUsd, qty: i.quantity })),
    }, "orders: total mismatch");
    res.status(400).json({ error: "Total mismatch. Please refresh and try again." }); return;
  }

  let walletDeduction = 0;
  const reqWallet = parsed.data.walletAmountUsd ?? 0;
  if (reqWallet > 0) {
    if (!userId) { res.status(400).json({ error: "Wallet payment requires login" }); return; }
    const bal = await getWalletBalance(userId);
    walletDeduction = Math.min(reqWallet, bal, computedTotal);
    if (walletDeduction < reqWallet - 0.01) { res.status(400).json({ error: "Insufficient wallet balance" }); return; }
  }

  const isNet30 = parsed.data.paymentMethod === "net30";
  if (isNet30 && !userId) { res.status(401).json({ error: "Login required for invoice payment" }); return; }
  if (isNet30) {
    const [u] = await db.select({ ba: users.businessApproved }).from(users).where(eq(users.id, userId!)).limit(1);
    if (!u?.ba) { res.status(403).json({ error: "Invoice payment requires an approved business account" }); return; }
  }
  const cardTotal = Math.max(0, computedTotal - walletDeduction);
  if (cardTotal > 0.01 && !isNet30) { res.status(400).json({ error: "Card payment must go through checkout" }); return; }

  try {
    const pricedItems = items.map((it) => {
      if (serverPrices && it.variantId > 0) {
        const lk = `${it.bundleId ?? "s"}-${it.variantId}`;
        const sp = serverPrices.get(lk);
        if (sp) return { ...it, priceUsd: sp };
      }
      return it;
    });
    const result = await executeOrderPipeline({
      billing, items: pricedItems, coupon: serverCoupon, cppSelected: cppSelected ?? false,
      subtotal, discountAmount, taxRate, taxAmount, vatNumber: vatNumber ?? null,
      total: computedTotal, orderNumber: generateOrderNumber(),
      paymentMethod: isNet30 ? "net30" : "card",
      guestPassword: parsed.data.guestPassword, giftCards: serverGiftCards,
      affiliateRefCode: getRefCookie(req),
      flashVariantMap: flashVariantMap.size > 0 ? flashVariantMap : undefined,
      loyaltyPointsUsed: loyaltyPtsUsed || undefined, loyaltyDiscount: loyaltyDisc || undefined,
      walletAmountUsd: walletDeduction > 0 ? walletDeduction : undefined,
      userId, services: validatedServices.length > 0 ? validatedServices : undefined,
      locale: userLocale, clientIp: req.ip ?? (req.headers["x-real-ip"] as string) ?? "",
      attribution: parsed.data.attribution ?? undefined,
      sessionId: req.sessionId ?? null,
    });
    res.status(201).json({ orderNumber: result.orderNumber, status: result.status, message: "Order placed successfully" });
  } catch (err) {
    logger.error({ err }, "Order pipeline failed");
    res.status(500).json({ error: "Failed to process order" });
  }
});

export default router;
