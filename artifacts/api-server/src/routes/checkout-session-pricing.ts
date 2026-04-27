import { inArray, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants, taxSettings, taxRates, checkoutServices, siteSettings } from "@workspace/db/schema";
import { validateCouponServerSide } from "../services/coupon-service";
import { validateGiftCards, loadGiftCardBalances } from "../services/gift-card-service";
import { loadBundlePriceMap } from "../services/bundle-pricing";
import { getFlashSaleInfo } from "../services/flash-sale-pricing";
import { getBulkDiscount } from "../services/bulk-pricing-service";
import { getLoyaltyConfig, getOrCreateAccount, pointsToDiscount } from "../services/loyalty-service";
import { applyProcessingFee } from "./checkout-session-helpers";
import { logger } from "../lib/logger";

export type CheckoutItem = {
  variantId: number; productId: number; productName: string; variantName: string;
  imageUrl?: string | null; priceUsd: string; quantity: number; platform?: string | null; bundleId?: number;
};

export interface CheckoutTotals {
  effectivePrices: Map<string, string>;
  flashVariantMap: Map<number, number>;
  serverCoupon: Awaited<ReturnType<typeof validateCouponServerSide>>;
  serverGiftCards: Array<{ code: string; amount: number }>;
  subtotal: number;
  discountAmount: number;
  loyaltyDisc: number;
  loyaltyPtsUsed: number;
  loyaltyAccountId: number | undefined;
  validatedServices: Array<{ id: number; name: string; priceUsd: string }>;
  cppAmount: number;
  feeBase: number;
  processingFee: number;
  taxRate: number;
  taxAmount: number;
  computedTotal: number;
  chargeCurrency: string;
}

type CheckoutInput = {
  items: CheckoutItem[];
  billing: { country: string };
  coupon?: { code: string; pct: number; label: string } | null;
  cppSelected?: boolean;
  vatNumber?: string;
  total: string;
  giftCards?: Array<{ code: string; amount: number }>;
  loyaltyPointsUsed?: number;
  serviceIds?: number[];
  userId?: number;
};

export async function calculateCheckoutTotals(input: CheckoutInput): Promise<CheckoutTotals | { error: string }> {
  const { items, billing, coupon, cppSelected, vatNumber, total, giftCards: gcInput, loyaltyPointsUsed, serviceIds, userId } = input;

  const variantIds = items.filter((i) => i.variantId > 0).map((i) => i.variantId);
  const dbVariants = variantIds.length
    ? await db.select({ id: productVariants.id, priceUsd: productVariants.priceUsd, priceOverrideUsd: productVariants.priceOverrideUsd, productId: productVariants.productId })
        .from(productVariants).where(inArray(productVariants.id, variantIds))
    : [];

  const variantMap = new Map(dbVariants.map((v) => [v.id, v]));
  if (dbVariants.length !== variantIds.length) {
    const missing = variantIds.filter((id) => !variantMap.has(id));
    return { error: `Variant(s) not found: ${missing.join(", ")}` };
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
      if (!serverBundlePrice) return { error: `Bundle pricing not found for ${item.productName}` };
      if (Math.abs(parseFloat(serverBundlePrice) - parseFloat(item.priceUsd)) > 0.02) return { error: `Bundle price changed for ${item.productName}` };
      effectivePrices.set(lineKey, serverBundlePrice);
      continue;
    }
    if (item.variantId <= 0) continue;

    const dbVariant = variantMap.get(item.variantId);
    const basePrice = dbVariant?.priceOverrideUsd ? parseFloat(dbVariant.priceOverrideUsd) : parseFloat(dbVariant?.priceUsd ?? item.priceUsd);
    const fi = flashInfo.get(item.variantId);
    if (fi) {
      const totalQty = (flashQtyAgg.get(item.variantId) ?? 0) + item.quantity;
      flashQtyAgg.set(item.variantId, totalQty);
      if (totalQty > fi.maxQuantity - fi.soldCount) return { error: `Only ${fi.maxQuantity - fi.soldCount} left in flash sale for ${item.productName}` };
      flashVariantMap.set(item.variantId, fi.flashSaleId);
      effectivePrices.set(lineKey, fi.salePriceUsd);
    } else {
      let effectivePrice = basePrice;
      const bulkDiscountPct = await getBulkDiscount(dbVariant?.productId ?? item.productId, item.quantity);
      if (bulkDiscountPct > 0) effectivePrice = Math.round(effectivePrice * (1 - bulkDiscountPct / 100) * 100) / 100;
      if (Math.abs(effectivePrice - parseFloat(item.priceUsd)) > 0.02) return { error: `Price changed for ${item.productName}` };
      effectivePrices.set(lineKey, effectivePrice.toFixed(2));
    }
  }

  let serverCoupon: Awaited<ReturnType<typeof validateCouponServerSide>> = null;
  if (coupon?.code) {
    serverCoupon = await validateCouponServerSide(coupon.code);
    if (!serverCoupon) return { error: "Invalid or expired coupon code" };
  }

  let serverGiftCards: Array<{ code: string; amount: number }> = [];
  if (gcInput?.length) {
    const deduped = new Map<string, number>();
    for (const gc of gcInput) deduped.set(gc.code.trim().toUpperCase(), (deduped.get(gc.code.trim().toUpperCase()) ?? 0) + gc.amount);
    const dedupedList = Array.from(deduped, ([code, amount]) => ({ code, amount }));
    const gcResult = await validateGiftCards(dedupedList);
    if (!gcResult.valid) return { error: gcResult.error ?? "Invalid gift card" };
    const balances = await loadGiftCardBalances(dedupedList.map((g) => g.code));
    serverGiftCards = dedupedList.map((gc) => ({ code: gc.code, amount: Math.min(gc.amount, balances.get(gc.code) ?? 0) }));
  }

  const subtotal = items.reduce((sum, it) => {
    const lk = `${it.bundleId ?? "s"}-${it.variantId}`;
    const price = it.variantId > 0 ? (effectivePrices.get(lk) ?? it.priceUsd) : it.priceUsd;
    return sum + parseFloat(price) * it.quantity;
  }, 0);

  if (serverCoupon?.minOrderUsd && subtotal < serverCoupon.minOrderUsd) {
    return { error: `Coupon requires a minimum order of $${serverCoupon.minOrderUsd.toFixed(2)}` };
  }

  let couponDiscount = 0;
  if (serverCoupon) {
    if (serverCoupon.type === "FIXED") {
      couponDiscount = Math.min(serverCoupon.amount, subtotal);
    } else {
      couponDiscount = subtotal * (serverCoupon.pct / 100);
      if (serverCoupon.maxDiscountUsd && couponDiscount > serverCoupon.maxDiscountUsd) couponDiscount = serverCoupon.maxDiscountUsd;
    }
  }

  let loyaltyDisc = 0, loyaltyPtsUsed = 0, loyaltyAccountId: number | undefined;
  const reqPts = loyaltyPointsUsed ?? 0;
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

  let servicesAmount = 0;
  let validatedServices: Array<{ id: number; name: string; priceUsd: string }> = [];
  const dedupedServiceIds = [...new Set(serviceIds ?? [])];
  if (dedupedServiceIds.length) {
    const dbServices = await db.select().from(checkoutServices).where(inArray(checkoutServices.id, dedupedServiceIds));
    const enabledServices = dbServices.filter((s) => s.enabled);
    if (enabledServices.length !== dedupedServiceIds.length) return { error: "One or more selected services are unavailable" };
    validatedServices = enabledServices.map((s) => ({ id: s.id, name: s.name, priceUsd: s.priceUsd }));
    servicesAmount = enabledServices.reduce((s, svc) => s + parseFloat(svc.priceUsd), 0);
  }

  const [feeSettings] = await db.select({ cppPrice: siteSettings.cppPrice, processingFeePercent: siteSettings.processingFeePercent, processingFeeFixed: siteSettings.processingFeeFixed, processingFeeTiers: siteSettings.processingFeeTiers, defaultCurrency: siteSettings.defaultCurrency }).from(siteSettings);
  const chargeCurrency = (feeSettings?.defaultCurrency ?? "EUR").toLowerCase();
  const discountAmount = couponDiscount + loyaltyDisc;
  const cppAmount = cppSelected ? (Number(feeSettings?.cppPrice) || 0) : 0;
  const feeBase = subtotal - discountAmount + cppAmount + servicesAmount;
  const processingFee = applyProcessingFee(feeBase, feeSettings?.processingFeeTiers, Number(feeSettings?.processingFeePercent) || 0, Number(feeSettings?.processingFeeFixed) || 0);

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
      taxAmount = taxConfig.priceDisplay === "inclusive"
        ? Math.round((beforeTax - beforeTax / (1 + taxRate / 100)) * 100) / 100
        : Math.round(beforeTax * (taxRate / 100) * 100) / 100;
    }
  }

  const isInclusive = taxConfig?.priceDisplay === "inclusive";
  const preGcTotal = isInclusive ? feeBase + processingFee : feeBase + processingFee + taxAmount;
  const gcDeduction = serverGiftCards.reduce((s, c) => s + c.amount, 0);
  if (gcDeduction > preGcTotal + 0.01) return { error: "Gift card amount exceeds order total" };
  const computedTotal = Math.max(0, preGcTotal - gcDeduction);

  if (Math.abs(computedTotal - parseFloat(total)) > 0.02) {
    logger.warn({ clientTotal: total, serverTotal: computedTotal.toFixed(4), subtotal: subtotal.toFixed(4), feeBase: feeBase.toFixed(4), processingFee: processingFee.toFixed(4), taxAmount: taxAmount.toFixed(4), gcDeduction: gcDeduction.toFixed(4), discountAmount: discountAmount.toFixed(4) }, "checkout/session: total mismatch");
    return { error: "Total mismatch. Please refresh and try again." };
  }

  return { effectivePrices, flashVariantMap, serverCoupon, serverGiftCards, subtotal, discountAmount, loyaltyDisc, loyaltyPtsUsed, loyaltyAccountId, validatedServices, cppAmount, feeBase, processingFee, taxRate, taxAmount, computedTotal, chargeCurrency };
}
