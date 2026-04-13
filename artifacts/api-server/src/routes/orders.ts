import { Router } from "express";
import { z } from "zod";
import { inArray, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants, taxSettings, taxRates, checkoutServices, users } from "@workspace/db/schema";
import { executeOrderPipeline } from "../services/order-pipeline";
import { validateCouponServerSide } from "../services/coupon-service";
import { validateGiftCards, loadGiftCardBalances } from "../services/gift-card-service";
import { loadBundlePriceMap } from "../services/bundle-pricing";
import { getFlashSaleInfo } from "../services/flash-sale-pricing";
import { getBulkDiscount } from "../services/bulk-pricing-service";
import { resolvePrice } from "../services/resolve-price";
import { getRefCookie } from "../middleware/referral";
import { verifyToken } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getLoyaltyConfig, getOrCreateAccount, pointsToDiscount } from "../services/loyalty-service";
import { getWalletBalance } from "../services/wallet-service";
import { requireIdempotencyKey } from "../middleware/idempotency";

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
  platform: z.string().optional(), bundleId: z.number().int().optional(),
});
const orderSchema = z.object({
  billing: billingSchema,
  items: z.array(itemSchema).min(1).max(50),
  coupon: z.object({ code: z.string().min(1).max(50), pct: z.number(), label: z.string() }).nullable().optional(),
  cppSelected: z.boolean().optional(),
  vatNumber: z.string().max(50).optional(), total: currencyStr,
  payment: z.object({ cardToken: z.string().optional() }),
  paymentMethod: z.enum(["card", "net30"]).optional(),
  walletAmountUsd: z.number().min(0).optional(),
  guestPassword: z.string().min(8).optional(),
  giftCards: z.array(z.object({ code: z.string(), amount: z.number().positive() })).optional(),
  loyaltyPointsUsed: z.number().int().min(0).optional(),
  serviceIds: z.array(z.number().int().positive()).max(10).optional(),
  locale: z.string().max(10).optional(),
});

const CPP_RATE = 0.05;
const generateOrderNumber = () => `PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// ── Shared return type ────────────────────────────────────────────────────────
type PriceResult = {
  prices: Map<string, string> | null;
  flashVariantMap: Map<number, number>;
  error: string | null;
};

// ── Bundle composition validator (shared by both paths) ───────────────────────
async function validateBundles(
  items: z.infer<typeof orderSchema>["items"],
): Promise<{
  bundlePriceMap: Map<string, string>;
  error: string | null;
}> {
  const { priceMap: bundlePriceMap, expectedProducts } = await loadBundlePriceMap(items);
  const bProductSets = new Map<number, Set<number>>();
  const bQtys = new Map<number, number | null>();

  for (const it of items) {
    if (!it.bundleId) continue;
    if (!bProductSets.has(it.bundleId)) bProductSets.set(it.bundleId, new Set());
    const pSet = bProductSets.get(it.bundleId)!;
    if (pSet.has(it.productId)) return { bundlePriceMap, error: "Duplicate product in bundle" };
    pSet.add(it.productId);
    const prev = bQtys.get(it.bundleId);
    if (prev === undefined) bQtys.set(it.bundleId, it.quantity);
    else if (prev !== it.quantity) bQtys.set(it.bundleId, null);
  }

  for (const [bid, reqProducts] of expectedProducts) {
    const submitted = bProductSets.get(bid);
    if (!submitted || submitted.size !== reqProducts.size || [...reqProducts].some((p) => !submitted.has(p))) {
      return { bundlePriceMap, error: "Bundle composition does not match required products" };
    }
    if (bQtys.get(bid) === null) {
      return { bundlePriceMap, error: "All items in a bundle must have the same quantity" };
    }
  }

  return { bundlePriceMap, error: null };
}

// ── ENGINE PATH (PRICING_ENGINE_V2=true) ──────────────────────────────────────
// Delegates non-bundle price resolution to resolve-price.ts.
// Bundle pricing is unchanged (not routed through the engine by design).
// Flash sale quantity validation is kept here because the engine only checks
// whether at least one unit is available, not aggregate cart quantities.
async function validateAndPriceItemsEngine(
  items: z.infer<typeof orderSchema>["items"],
): Promise<PriceResult> {
  const noResult = (e: string | null): PriceResult => ({
    prices: null,
    flashVariantMap: new Map(),
    error: e,
  });

  // ── Bundles ────────────────────────────────────────────────────────────────
  const { bundlePriceMap, error: bundleError } = await validateBundles(items);
  if (bundleError) return noResult(bundleError);

  const effectivePrices = new Map<string, string>();
  const flashVariantMap = new Map<number, number>();

  // Populate bundle prices
  for (const item of items.filter((i) => i.bundleId)) {
    const bundleKey = `${item.bundleId}-${item.variantId}`;
    const serverBundlePrice = bundlePriceMap.get(bundleKey);
    if (!serverBundlePrice) return noResult(`Bundle pricing not found for ${item.productName}`);
    if (Math.abs(parseFloat(serverBundlePrice) - parseFloat(item.priceUsd)) > 0.02) {
      return noResult(`Bundle price changed for ${item.productName}`);
    }
    effectivePrices.set(bundleKey, serverBundlePrice);
  }

  // ── Non-bundle items ───────────────────────────────────────────────────────
  const nonBundleItems = items.filter((i) => !i.bundleId && i.variantId > 0);
  if (nonBundleItems.length === 0) return { prices: effectivePrices, flashVariantMap, error: null };

  const nonBundleVarIds = nonBundleItems.map((i) => i.variantId);

  // Flash sale quantity validation (engine doesn't aggregate across cart lines)
  const flashInfo = await getFlashSaleInfo(nonBundleVarIds);
  const flashQtyAgg = new Map<number, number>();
  for (const item of nonBundleItems) {
    const fi = flashInfo.get(item.variantId);
    if (!fi) continue;
    const totalQty = (flashQtyAgg.get(item.variantId) ?? 0) + item.quantity;
    flashQtyAgg.set(item.variantId, totalQty);
    const remaining = fi.maxQuantity - fi.soldCount;
    if (totalQty > remaining) {
      return noResult(`Only ${remaining} left in flash sale for ${item.productName}`);
    }
    flashVariantMap.set(item.variantId, fi.flashSaleId);
  }

  // Resolve price for each non-bundle item via the canonical engine
  for (const item of nonBundleItems) {
    let resolved: Awaited<ReturnType<typeof resolvePrice>>;
    try {
      resolved = await resolvePrice(item.variantId, item.quantity);
    } catch {
      return noResult(`Variant not found: ${item.variantId}`);
    }

    const serverPrice = parseFloat(resolved.effectiveUnitPriceUsd);

    // Tolerance: allow ±$0.02 between client-submitted price and server-computed price
    if (Math.abs(serverPrice - parseFloat(item.priceUsd)) > 0.02) {
      logger.warn(
        {
          variantId: item.variantId,
          clientPrice: item.priceUsd,
          serverPrice: resolved.effectiveUnitPriceUsd,
          appliedStack: resolved.appliedStack,
        },
        "orders: engine price mismatch",
      );
      return noResult(`Price changed for ${item.productName}`);
    }

    effectivePrices.set(`s-${item.variantId}`, resolved.effectiveUnitPriceUsd);
  }

  return { prices: effectivePrices, flashVariantMap, error: null };
}

// ── LEGACY PATH (PRICING_ENGINE_V2 not set) ───────────────────────────────────
// Preserves original behaviour exactly. Safe to keep until flag is enabled.
async function validateAndPriceItemsLegacy(
  items: z.infer<typeof orderSchema>["items"],
): Promise<PriceResult> {
  const variantIds = items.filter((i) => i.variantId > 0).map((i) => i.variantId);
  const dbVariants = await db
    .select({
      id: productVariants.id,
      priceUsd: productVariants.priceUsd,
      priceOverrideUsd: productVariants.priceOverrideUsd,
      productId: productVariants.productId,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds));

  const noResult = (e: string | null): PriceResult => ({
    prices: null,
    flashVariantMap: new Map(),
    error: e,
  });

  if (dbVariants.length === 0) return noResult(null);
  const variantMap = new Map(dbVariants.map((v) => [v.id, v]));
  const priceMap   = new Map(dbVariants.map((v) => [v.id, v.priceUsd]));
  if (dbVariants.length !== variantIds.length) {
    return noResult(`Variant(s) not found: ${variantIds.filter((id) => !priceMap.has(id)).join(", ")}`);
  }

  const flashInfo    = await getFlashSaleInfo(variantIds);
  const flashVariantMap = new Map<number, number>();
  const flashQtyAgg  = new Map<number, number>();

  const { bundlePriceMap, error: bundleError } = await validateBundles(items);
  if (bundleError) return noResult(bundleError);

  const effectivePrices = new Map<string, string>();

  for (const item of items) {
    const lineKey  = `${item.bundleId ?? "s"}-${item.variantId}`;
    const dbVariant = variantMap.get(item.variantId);
    const dbPrice  = priceMap.get(item.variantId);
    if (!dbPrice) continue;

    // Bundle items
    if (item.bundleId) {
      const bundleKey = `${item.bundleId}-${item.variantId}`;
      const serverBundlePrice = bundlePriceMap.get(bundleKey);
      if (!serverBundlePrice) return noResult(`Bundle pricing not found for ${item.productName}`);
      if (Math.abs(parseFloat(serverBundlePrice) - parseFloat(item.priceUsd)) > 0.02) {
        return noResult(`Bundle price changed for ${item.productName}`);
      }
      effectivePrices.set(lineKey, serverBundlePrice);
      continue;
    }

    // Apply priceOverrideUsd if set
    const basePrice = dbVariant?.priceOverrideUsd
      ? parseFloat(dbVariant.priceOverrideUsd)
      : parseFloat(dbPrice);

    const fi = flashInfo.get(item.variantId);
    if (fi) {
      const totalQty = (flashQtyAgg.get(item.variantId) ?? 0) + item.quantity;
      flashQtyAgg.set(item.variantId, totalQty);
      const remaining = fi.maxQuantity - fi.soldCount;
      if (totalQty > remaining) {
        return noResult(`Only ${remaining} left in flash sale for ${item.productName}`);
      }
      flashVariantMap.set(item.variantId, fi.flashSaleId);
      effectivePrices.set(lineKey, fi.salePriceUsd);
    } else {
      let effectivePrice = basePrice;
      const productIdForBulk = dbVariant?.productId ?? item.productId;
      const bulkDiscountPct = await getBulkDiscount(productIdForBulk, item.quantity);
      if (bulkDiscountPct > 0) {
        effectivePrice = Math.round(effectivePrice * (1 - bulkDiscountPct / 100) * 100) / 100;
        logger.info(
          { variantId: item.variantId, productId: productIdForBulk, quantity: item.quantity, bulkDiscountPct, effectivePrice },
          "orders/legacy: bulk discount applied",
        );
      }
      const effectivePriceStr = effectivePrice.toFixed(2);
      if (Math.abs(effectivePrice - parseFloat(item.priceUsd)) > 0.02) {
        return noResult(`Price changed for ${item.productName}`);
      }
      effectivePrices.set(lineKey, effectivePriceStr);
    }
  }

  return { prices: effectivePrices, flashVariantMap, error: null };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function validateAndPriceItems(
  items: z.infer<typeof orderSchema>["items"],
): Promise<PriceResult> {
  if (process.env["PRICING_ENGINE_V2"] === "true") {
    return validateAndPriceItemsEngine(items);
  }
  return validateAndPriceItemsLegacy(items);
}

router.post("/orders", requireIdempotencyKey(), async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order data", details: parsed.error.flatten() }); return;
  }
  const { billing, items, coupon, cppSelected, vatNumber, total, payment, giftCards: gcInput } = parsed.data;
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
    if (!serverCoupon) {
      res.status(400).json({ error: "Invalid or expired coupon code" });
      return;
    }
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

  // Fix 1 (minOrderUsd): enforce minimum order amount for coupon
  if (serverCoupon?.minOrderUsd && subtotal < serverCoupon.minOrderUsd) {
    res.status(400).json({
      error: `Coupon requires a minimum order of $${serverCoupon.minOrderUsd.toFixed(2)}`,
    });
    return;
  }

  // Fix 1 (FIXED/maxDiscountUsd): compute coupon discount correctly for both types
  let couponDiscount = 0;
  if (serverCoupon) {
    if (serverCoupon.type === "FIXED") {
      // Fixed dollar discount — cap at subtotal
      couponDiscount = Math.min(serverCoupon.amount, subtotal);
    } else {
      // Percentage discount
      couponDiscount = subtotal * (serverCoupon.pct / 100);
      // Fix 1 (maxDiscountUsd): cap percentage discount
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
    const dbServices = await db.select().from(checkoutServices)
      .where(inArray(checkoutServices.id, dedupedServiceIds));
    const enabledServices = dbServices.filter((s) => s.enabled);
    if (enabledServices.length !== dedupedServiceIds.length) {
      res.status(400).json({ error: "One or more selected services are unavailable" }); return;
    }
    validatedServices = enabledServices.map((s) => ({ id: s.id, name: s.name, priceUsd: s.priceUsd }));
    servicesAmount = enabledServices.reduce((s, svc) => s + parseFloat(svc.priceUsd), 0);
  }
  const discountAmount = couponDiscount + loyaltyDisc;
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
      const beforeTax = subtotal - discountAmount + cppAmount + servicesAmount;
      if (taxConfig.priceDisplay === "inclusive") {
        taxAmount = Math.round((beforeTax - beforeTax / (1 + taxRate / 100)) * 100) / 100;
      } else {
        taxAmount = Math.round(beforeTax * (taxRate / 100) * 100) / 100;
      }
    }
  }

  const isInclusive = taxConfig?.priceDisplay === "inclusive";
  const preGcTotal = isInclusive
    ? subtotal - discountAmount + cppAmount + servicesAmount
    : subtotal - discountAmount + cppAmount + servicesAmount + taxAmount;
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
  const isNet30 = parsed.data.paymentMethod === "net30";
  if (isNet30 && !userId) { res.status(401).json({ error: "Login required for invoice payment" }); return; }
  if (isNet30) { const [u] = await db.select({ ba: users.businessApproved }).from(users).where(eq(users.id, userId!)).limit(1); if (!u?.ba) { res.status(403).json({ error: "Invoice payment requires an approved business account" }); return; } }
  const cardTotal = Math.max(0, computedTotal - walletDeduction);
  if (cardTotal > 0.01 && !payment.cardToken && !isNet30) { res.status(400).json({ error: "Card payment required" }); return; }

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
      billing,
      items: pricedItems,
      coupon: serverCoupon,
      cppSelected: cppSelected ?? false,
      subtotal,
      discountAmount,
      taxRate,
      taxAmount,
      vatNumber: vatNumber ?? null,
      total: computedTotal,
      orderNumber: generateOrderNumber(),
      cardToken: payment.cardToken ?? "",
      paymentMethod: isNet30 ? "net30" : "card",
      guestPassword: parsed.data.guestPassword,
      giftCards: serverGiftCards,
      affiliateRefCode: getRefCookie(req),
      flashVariantMap: flashVariantMap.size > 0 ? flashVariantMap : undefined,
      loyaltyPointsUsed: loyaltyPtsUsed || undefined,
      loyaltyDiscount: loyaltyDisc || undefined,
      walletAmountUsd: walletDeduction > 0 ? walletDeduction : undefined,
      userId,
      services: validatedServices.length > 0 ? validatedServices : undefined,
      locale: userLocale,
    });

    res.status(201).json({ orderNumber: result.orderNumber, status: result.status, message: "Order placed successfully" });
  } catch (err) {
    logger.error({ err }, "Order pipeline failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to process order" });
  }
});

export default router;
