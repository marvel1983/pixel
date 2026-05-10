import { db } from "@workspace/db";
import { products, productVariants } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { computeBundlePrice, type BundleComponentInput, type BundleDiscountType } from "./bundle-pricing";

export interface BundleSaveInput {
  primaryProductId: number;
  productIds: number[];
  freeProductIds: number[];
  discountType: BundleDiscountType;
  discountValue: string;
}

/**
 * §5.9 — every component must be active and have ≥1 active variant.
 * Anchor must exist (active flag handled separately by the caller).
 */
export async function validateBundleRule(d: BundleSaveInput): Promise<string | null> {
  if (d.productIds.includes(d.primaryProductId)) {
    return "Anchor product must NOT be in component productIds (anchor wraps the bundle, components fill it)";
  }
  if (new Set(d.productIds).size !== d.productIds.length) return "Duplicate component productIds";
  for (const id of d.freeProductIds) {
    if (!d.productIds.includes(id)) return "freeProductIds must be a subset of productIds";
  }
  const v = Number(d.discountValue);
  if (!Number.isFinite(v) || v < 0) return "discountValue must be non-negative";
  if (d.discountType === "PERCENTAGE" && v > 100) return "Percentage discount must be 0–100";
  if (d.discountType === "BUY_X_GET_Y_FREE" && d.freeProductIds.length === 0) {
    return "BUY_X_GET_Y_FREE requires at least one free component";
  }
  const allIds = [d.primaryProductId, ...d.productIds];
  const productRows = await db.select({ id: products.id, isActive: products.isActive })
    .from(products).where(inArray(products.id, allIds));
  for (const id of allIds) {
    const row = productRows.find((r) => r.id === id);
    if (!row) return `Product ${id} not found`;
    if (!row.isActive && id !== d.primaryProductId) return `Component ${id} is inactive`;
  }
  if (d.productIds.length > 0) {
    const variantRows = await db.selectDistinct({ productId: productVariants.productId })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, d.productIds), eq(productVariants.isActive, true)));
    const withVariants = new Set(variantRows.map((r) => r.productId));
    for (const id of d.productIds) {
      if (!withVariants.has(id)) return `Component ${id} has no active variants`;
    }
  }
  return null;
}

/**
 * Compute a live preview price using the cheapest active variant per component.
 */
export async function pricePreviewFor(
  productIds: number[],
  freeProductIds: number[],
  rule: { discountType: BundleDiscountType; discountValue: string },
) {
  if (productIds.length === 0) return computeBundlePrice([], rule);
  const variants = await db.select({
    productId: productVariants.productId,
    priceUsd: productVariants.priceUsd,
  })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)));

  const minByProduct = new Map<number, string>();
  for (const v of variants) {
    const cur = minByProduct.get(v.productId);
    if (cur === undefined || Number(v.priceUsd) < Number(cur)) minByProduct.set(v.productId, v.priceUsd);
  }

  const freeSet = new Set(freeProductIds);
  const components: BundleComponentInput[] = productIds.map((pid) => ({
    productId: pid,
    unitPriceUsd: minByProduct.get(pid) ?? "0",
    isFree: freeSet.has(pid),
  }));
  return computeBundlePrice(components, rule);
}
