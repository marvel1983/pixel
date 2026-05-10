import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { bundles, bundleItems, productVariants } from "@workspace/db/schema";

/**
 * --- Bundle pricing engine (rev 2: anchor-as-wrapper) ---
 *
 * The anchor product is NEVER an input here. Components are the products
 * that fill the bundle; the anchor's displayed price IS the engine's
 * `finalUsd`.
 *
 * Stacking order in the wider cart pipeline (Donnie-locked):
 *   1. per-line bundle adjustment (this engine)
 *   2. cart subtotal
 *   3. loyalty / gift-card deductions
 *   4. coupon
 *   5. tax / fees
 *
 * Money is stored as decimal strings; we round once at the boundary so a
 * 33.33% discount never produces a 14.665999... cent line item.
 */

export type BundleDiscountType = "PERCENTAGE" | "FIXED" | "BUY_X_GET_Y_FREE";

export interface BundleComponentInput {
  productId: number;
  unitPriceUsd: string;
  isFree: boolean;
}

export interface BundleRuleInput {
  discountType: BundleDiscountType;
  discountValue: string;
  // NOTE: minPrimaryQty intentionally absent — engine ignores quantity gates.
  // See docs/bundles-feature-spec.md §3.2.
}

export interface BundleComponentLine extends BundleComponentInput {
  lineTotalUsd: string;
}

export interface BundlePricing {
  sumOriginalUsd: string;
  finalUsd: string;
  savingsUsd: string;
  components: BundleComponentLine[];
}

function roundMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function parseAmount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computes the price the anchor will display from its components + rule.
 *
 *   sumOriginal = Σ component.unitPriceUsd
 *   sumPaid     = Σ component.unitPriceUsd  (where !isFree)
 *
 *   PERCENTAGE       → final = sumPaid × (1 − pct/100)
 *   FIXED            → final = max(0, sumPaid − discountValue)
 *   BUY_X_GET_Y_FREE → final = sumPaid       (the rule IS the is_free flags)
 */
export function computeBundlePrice(
  components: BundleComponentInput[],
  rule: BundleRuleInput,
): BundlePricing {
  const discountValue = parseAmount(rule.discountValue);

  const lines: BundleComponentLine[] = components.map((c) => {
    const unitPrice = parseAmount(c.unitPriceUsd);
    return {
      ...c,
      lineTotalUsd: c.isFree ? "0.00" : roundMoney(unitPrice),
    };
  });

  const sumOriginal = components.reduce((acc, c) => acc + parseAmount(c.unitPriceUsd), 0);
  const sumPaid = lines.reduce((acc, l) => acc + parseAmount(l.lineTotalUsd), 0);

  let final: number;
  switch (rule.discountType) {
    case "PERCENTAGE": {
      const pct = Math.min(100, Math.max(0, discountValue));
      final = sumPaid * (1 - pct / 100);
      break;
    }
    case "FIXED": {
      final = Math.max(0, sumPaid - Math.max(0, discountValue));
      break;
    }
    case "BUY_X_GET_Y_FREE":
      final = sumPaid;
      break;
  }

  const finalRounded = roundMoney(final);
  const savings = roundMoney(Math.max(0, sumOriginal - parseAmount(finalRounded)));

  return {
    sumOriginalUsd: roundMoney(sumOriginal),
    finalUsd: finalRounded,
    savingsUsd: savings,
    components: lines,
  };
}

/**
 * Snapshot shape — what we freeze on the cart line at add-to-cart time, so
 * subsequent admin changes don't perturb open checkouts.
 */
export interface BundleCartSnapshot {
  bundleId: number;
  bundleSlug: string;
  bundleName: string;
  anchorProductId: number;
  rule: BundleRuleInput;
  components: BundleComponentLine[];
  pricing: { sumOriginalUsd: string; finalUsd: string; savingsUsd: string };
  capturedAt: string;
}

export function buildSnapshot(
  bundle: { id: number; slug: string; name: string; anchorProductId: number },
  rule: BundleRuleInput,
  components: BundleComponentInput[],
): BundleCartSnapshot {
  const pricing = computeBundlePrice(components, rule);
  return {
    bundleId: bundle.id,
    bundleSlug: bundle.slug,
    bundleName: bundle.name,
    anchorProductId: bundle.anchorProductId,
    rule,
    components: pricing.components,
    pricing: {
      sumOriginalUsd: pricing.sumOriginalUsd,
      finalUsd: pricing.finalUsd,
      savingsUsd: pricing.savingsUsd,
    },
    capturedAt: new Date().toISOString(),
  };
}

/**
 * --- Legacy ratio-based distribution for orders pipeline ---
 * Kept intact: existing order-creation flow uses this to spread the flat
 * `bundle_price_usd` across variants. The new engine above writes back to
 * `bundle_price_usd` on save, so this stays consistent.
 */

interface OrderItem { variantId: number; bundleId?: number; productId: number; }

export interface BundlePriceResult {
  priceMap: Map<string, string>;
  expectedProducts: Map<number, Set<number>>;
}

export async function loadBundlePriceMap(items: OrderItem[]): Promise<BundlePriceResult> {
  const bundleIds = [...new Set(items.filter((i) => i.bundleId).map((i) => i.bundleId!))];
  const priceMap = new Map<string, string>();
  const expectedProducts = new Map<number, Set<number>>();
  if (!bundleIds.length) return { priceMap, expectedProducts };

  for (const bid of bundleIds) {
    const [b] = await db.select({ bundlePriceUsd: bundles.bundlePriceUsd, isActive: bundles.isActive })
      .from(bundles).where(eq(bundles.id, bid)).limit(1);
    if (!b || !b.isActive) continue;

    const bItems = await db.select({ productId: bundleItems.productId })
      .from(bundleItems).where(eq(bundleItems.bundleId, bid)).orderBy(asc(bundleItems.sortOrder));
    const productIds = bItems.map((i) => i.productId);
    expectedProducts.set(bid, new Set(productIds));

    const variants = await db.select({ id: productVariants.id, priceUsd: productVariants.priceUsd, productId: productVariants.productId })
      .from(productVariants).where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)));

    const minByProduct = new Map<number, { id: number; price: string }>();
    for (const v of variants) {
      const cur = minByProduct.get(v.productId);
      if (!cur || parseFloat(v.priceUsd) < parseFloat(cur.price)) {
        minByProduct.set(v.productId, { id: v.id, price: v.priceUsd });
      }
    }

    const individualTotal = [...minByProduct.values()].reduce((s, v) => s + parseFloat(v.price), 0);
    if (individualTotal === 0) {
      throw new Error(`Bundle ${bid} has zero individual total — cannot compute price ratio`);
    }
    const ratio = parseFloat(b.bundlePriceUsd) / individualTotal;

    for (const [, v] of minByProduct) {
      priceMap.set(`${bid}-${v.id}`, (parseFloat(v.price) * ratio).toFixed(2));
    }

    const bundleVariantIds = items.filter((i) => i.bundleId === bid).map((i) => i.variantId);
    for (const vid of bundleVariantIds) {
      if (!priceMap.has(`${bid}-${vid}`)) {
        const dbV = variants.find((v) => v.id === vid);
        if (dbV) priceMap.set(`${bid}-${vid}`, (parseFloat(dbV.priceUsd) * ratio).toFixed(2));
      }
    }
  }

  return { priceMap, expectedProducts };
}
