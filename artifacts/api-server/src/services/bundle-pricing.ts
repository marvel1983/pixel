import { eq, and, inArray, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { bundles, bundleItems, productVariants } from "@workspace/db/schema";

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
    if (individualTotal <= 0) continue;
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
