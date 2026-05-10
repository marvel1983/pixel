import { db } from "@workspace/db";
import { bundles, bundleItems, products, productVariants } from "@workspace/db/schema";
import { eq, asc, and, inArray } from "drizzle-orm";
import { computeBundlePrice, type BundleComponentInput, type BundleDiscountType } from "./bundle-pricing";

export interface PublicBundleComponent {
  productId: number;
  variantId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  platform: string | null;
  unitPriceUsd: string;
  /** Per-component allocated price for this bundle line — sums to bundle.finalUsd */
  allocatedPriceUsd: string;
  isFree: boolean;
}

export interface PublicBundle {
  id: number;
  slug: string;
  discountType: BundleDiscountType;
  discountValue: string;
  components: PublicBundleComponent[];
  pricing: {
    sumOriginalUsd: string;
    finalUsd: string;
    savingsUsd: string;
  };
}

/**
 * Loads the bundle attached to an anchor product, with components and live
 * pricing. Returns null if the anchor has no bundle, or if any component is
 * unavailable (inactive or no active variants) — §5.9 conservative OOS.
 */
export async function loadBundleForAnchor(anchorProductId: number): Promise<PublicBundle | null> {
  const [bundle] = await db
    .select({
      id: bundles.id,
      slug: bundles.slug,
      isActive: bundles.isActive,
      discountType: bundles.discountType,
      discountValue: bundles.discountValue,
    })
    .from(bundles)
    .where(eq(bundles.primaryProductId, anchorProductId))
    .limit(1);

  if (!bundle || !bundle.isActive) return null;

  const items = await db
    .select({
      productId: bundleItems.productId,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      isActive: products.isActive,
      isFree: bundleItems.isFree,
      sortOrder: bundleItems.sortOrder,
    })
    .from(bundleItems)
    .innerJoin(products, eq(bundleItems.productId, products.id))
    .where(eq(bundleItems.bundleId, bundle.id))
    .orderBy(asc(bundleItems.sortOrder));

  if (items.length === 0) return null;

  // §5.9: any inactive component → hide bundle entirely
  if (items.some((it) => !it.isActive)) return null;

  // Cheapest active variant per component
  const productIds = items.map((it) => it.productId);
  const variants = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      priceUsd: productVariants.priceUsd,
      platform: productVariants.platform,
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)));

  const cheapestByProduct = new Map<number, { variantId: number; priceUsd: string; platform: string | null }>();
  for (const v of variants) {
    const cur = cheapestByProduct.get(v.productId);
    if (cur === undefined || Number(v.priceUsd) < Number(cur.priceUsd)) {
      cheapestByProduct.set(v.productId, { variantId: v.id, priceUsd: v.priceUsd, platform: v.platform });
    }
  }
  // §5.9: any component without an active variant → hide
  for (const it of items) {
    if (!cheapestByProduct.has(it.productId)) return null;
  }

  const componentInputs: BundleComponentInput[] = items.map((it) => ({
    productId: it.productId,
    unitPriceUsd: cheapestByProduct.get(it.productId)?.priceUsd ?? "0",
    isFree: it.isFree,
  }));

  const pricing = computeBundlePrice(componentInputs, {
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
  });

  // Allocate the bundle's final price across PAID components proportionally to their
  // unit price, so the sum of allocations = pricing.finalUsd. Free components stay at 0.
  // First component absorbs any rounding remainder so the total adds up to the cent.
  const finalCents = Math.round(parseFloat(pricing.finalUsd) * 100);
  const paidUnits = items.filter((it) => !it.isFree).map((it) => ({
    pid: it.productId,
    cents: Math.round(parseFloat(cheapestByProduct.get(it.productId)?.priceUsd ?? "0") * 100),
  }));
  const totalPaidCents = paidUnits.reduce((acc, p) => acc + p.cents, 0);
  const allocCents = new Map<number, number>();
  let allocated = 0;
  for (let i = 0; i < paidUnits.length; i++) {
    const isLast = i === paidUnits.length - 1;
    const share = isLast
      ? finalCents - allocated
      : totalPaidCents > 0 ? Math.round((paidUnits[i].cents / totalPaidCents) * finalCents) : 0;
    allocCents.set(paidUnits[i].pid, share);
    allocated += share;
  }

  const components: PublicBundleComponent[] = items.map((it) => {
    const v = cheapestByProduct.get(it.productId)!;
    const allocated = it.isFree ? 0 : (allocCents.get(it.productId) ?? 0);
    return {
      productId: it.productId,
      variantId: v.variantId,
      name: it.name,
      slug: it.slug,
      imageUrl: it.imageUrl,
      platform: v.platform,
      unitPriceUsd: v.priceUsd,
      allocatedPriceUsd: (allocated / 100).toFixed(2),
      isFree: it.isFree,
    };
  });

  return {
    id: bundle.id,
    slug: bundle.slug,
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
    components,
    pricing: {
      sumOriginalUsd: pricing.sumOriginalUsd,
      finalUsd: pricing.finalUsd,
      savingsUsd: pricing.savingsUsd,
    },
  };
}
