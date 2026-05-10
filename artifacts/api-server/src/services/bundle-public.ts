import { db } from "@workspace/db";
import { bundles, bundleItems, products, productVariants } from "@workspace/db/schema";
import { eq, asc, and, inArray } from "drizzle-orm";
import { computeBundlePrice, type BundleComponentInput, type BundleDiscountType } from "./bundle-pricing";

export interface PublicBundleComponent {
  productId: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPriceUsd: string;
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
    .select({ productId: productVariants.productId, priceUsd: productVariants.priceUsd })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)));

  const minByProduct = new Map<number, string>();
  for (const v of variants) {
    const cur = minByProduct.get(v.productId);
    if (cur === undefined || Number(v.priceUsd) < Number(cur)) minByProduct.set(v.productId, v.priceUsd);
  }
  // §5.9: any component without an active variant → hide
  for (const it of items) {
    if (!minByProduct.has(it.productId)) return null;
  }

  const componentInputs: BundleComponentInput[] = items.map((it) => ({
    productId: it.productId,
    unitPriceUsd: minByProduct.get(it.productId) ?? "0",
    isFree: it.isFree,
  }));

  const pricing = computeBundlePrice(componentInputs, {
    discountType: bundle.discountType,
    discountValue: bundle.discountValue,
  });

  const components: PublicBundleComponent[] = items.map((it) => ({
    productId: it.productId,
    name: it.name,
    slug: it.slug,
    imageUrl: it.imageUrl,
    unitPriceUsd: minByProduct.get(it.productId) ?? "0",
    isFree: it.isFree,
  }));

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
