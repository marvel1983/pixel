import { inArray, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants } from "@workspace/db/schema";
import { getFlashSaleInfo } from "../services/flash-sale-pricing";
import { getBulkDiscount } from "../services/bulk-pricing-service";
import { resolvePrice } from "../services/resolve-price";
import { loadBundlePriceMap } from "../services/bundle-pricing";
import { logger } from "../lib/logger";

export type OrderItem = {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  imageUrl?: string | null;
  priceUsd: string;
  quantity: number;
  platform?: string | null;
  bundleId?: number;
};

export type PriceResult = {
  prices: Map<string, string> | null;
  flashVariantMap: Map<number, number>;
  error: string | null;
};

async function validateBundles(items: OrderItem[]): Promise<{ bundlePriceMap: Map<string, string>; error: string | null }> {
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

async function validateAndPriceItemsEngine(items: OrderItem[]): Promise<PriceResult> {
  const noResult = (e: string | null): PriceResult => ({ prices: null, flashVariantMap: new Map(), error: e });

  const { bundlePriceMap, error: bundleError } = await validateBundles(items);
  if (bundleError) return noResult(bundleError);

  const effectivePrices = new Map<string, string>();
  const flashVariantMap = new Map<number, number>();

  for (const item of items.filter((i) => i.bundleId)) {
    const bundleKey = `${item.bundleId}-${item.variantId}`;
    const serverBundlePrice = bundlePriceMap.get(bundleKey);
    if (!serverBundlePrice) return noResult(`Bundle pricing not found for ${item.productName}`);
    if (Math.abs(parseFloat(serverBundlePrice) - parseFloat(item.priceUsd)) > 0.02) {
      return noResult(`Bundle price changed for ${item.productName}`);
    }
    effectivePrices.set(bundleKey, serverBundlePrice);
  }

  const nonBundleItems = items.filter((i) => !i.bundleId && i.variantId > 0);
  if (nonBundleItems.length === 0) return { prices: effectivePrices, flashVariantMap, error: null };

  const nonBundleVarIds = nonBundleItems.map((i) => i.variantId);
  const flashInfo = await getFlashSaleInfo(nonBundleVarIds);
  const flashQtyAgg = new Map<number, number>();
  for (const item of nonBundleItems) {
    const fi = flashInfo.get(item.variantId);
    if (!fi) continue;
    const totalQty = (flashQtyAgg.get(item.variantId) ?? 0) + item.quantity;
    flashQtyAgg.set(item.variantId, totalQty);
    const remaining = fi.maxQuantity - fi.soldCount;
    if (totalQty > remaining) return noResult(`Only ${remaining} left in flash sale for ${item.productName}`);
    flashVariantMap.set(item.variantId, fi.flashSaleId);
  }

  for (const item of nonBundleItems) {
    let resolved: Awaited<ReturnType<typeof resolvePrice>>;
    try {
      resolved = await resolvePrice(item.variantId, item.quantity);
    } catch {
      return noResult(`Variant not found: ${item.variantId}`);
    }
    const serverPrice = parseFloat(resolved.effectiveUnitPriceUsd);
    if (Math.abs(serverPrice - parseFloat(item.priceUsd)) > 0.02) {
      logger.warn({ variantId: item.variantId, clientPrice: item.priceUsd, serverPrice: resolved.effectiveUnitPriceUsd, appliedStack: resolved.appliedStack }, "orders: engine price mismatch");
      return noResult(`Price changed for ${item.productName}`);
    }
    effectivePrices.set(`s-${item.variantId}`, resolved.effectiveUnitPriceUsd);
  }

  return { prices: effectivePrices, flashVariantMap, error: null };
}

async function validateAndPriceItemsLegacy(items: OrderItem[]): Promise<PriceResult> {
  const variantIds = items.filter((i) => i.variantId > 0).map((i) => i.variantId);
  const dbVariants = await db
    .select({ id: productVariants.id, priceUsd: productVariants.priceUsd, priceOverrideUsd: productVariants.priceOverrideUsd, productId: productVariants.productId })
    .from(productVariants).where(inArray(productVariants.id, variantIds));

  const noResult = (e: string | null): PriceResult => ({ prices: null, flashVariantMap: new Map(), error: e });
  if (dbVariants.length === 0) return noResult(null);

  const variantMap = new Map(dbVariants.map((v) => [v.id, v]));
  const priceMap = new Map(dbVariants.map((v) => [v.id, v.priceUsd]));
  if (dbVariants.length !== variantIds.length) {
    return noResult(`Variant(s) not found: ${variantIds.filter((id) => !priceMap.has(id)).join(", ")}`);
  }

  const flashInfo = await getFlashSaleInfo(variantIds);
  const flashVariantMap = new Map<number, number>();
  const flashQtyAgg = new Map<number, number>();
  const { bundlePriceMap, error: bundleError } = await validateBundles(items);
  if (bundleError) return noResult(bundleError);

  const effectivePrices = new Map<string, string>();

  for (const item of items) {
    const lineKey = `${item.bundleId ?? "s"}-${item.variantId}`;
    const dbVariant = variantMap.get(item.variantId);
    const dbPrice = priceMap.get(item.variantId);
    if (!dbPrice) continue;

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

    const basePrice = dbVariant?.priceOverrideUsd ? parseFloat(dbVariant.priceOverrideUsd) : parseFloat(dbPrice);
    const fi = flashInfo.get(item.variantId);
    if (fi) {
      const totalQty = (flashQtyAgg.get(item.variantId) ?? 0) + item.quantity;
      flashQtyAgg.set(item.variantId, totalQty);
      const remaining = fi.maxQuantity - fi.soldCount;
      if (totalQty > remaining) return noResult(`Only ${remaining} left in flash sale for ${item.productName}`);
      flashVariantMap.set(item.variantId, fi.flashSaleId);
      effectivePrices.set(lineKey, fi.salePriceUsd);
    } else {
      let effectivePrice = basePrice;
      const productIdForBulk = dbVariant?.productId ?? item.productId;
      const bulkDiscountPct = await getBulkDiscount(productIdForBulk, item.quantity);
      if (bulkDiscountPct > 0) {
        effectivePrice = Math.round(effectivePrice * (1 - bulkDiscountPct / 100) * 100) / 100;
        logger.info({ variantId: item.variantId, productId: productIdForBulk, quantity: item.quantity, bulkDiscountPct, effectivePrice }, "orders/legacy: bulk discount applied");
      }
      const effectivePriceStr = effectivePrice.toFixed(2);
      if (Math.abs(effectivePrice - parseFloat(item.priceUsd)) > 0.02) return noResult(`Price changed for ${item.productName}`);
      effectivePrices.set(lineKey, effectivePriceStr);
    }
  }

  return { prices: effectivePrices, flashVariantMap, error: null };
}

export async function validateAndPriceItems(items: OrderItem[]): Promise<PriceResult> {
  if (process.env["PRICING_ENGINE_V2"] === "true") {
    return validateAndPriceItemsEngine(items);
  }
  return validateAndPriceItemsLegacy(items);
}
