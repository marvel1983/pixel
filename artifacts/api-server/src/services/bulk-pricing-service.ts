import { eq, and, lte, or, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import { bulkPricingTiers } from "@workspace/db/schema";
import { logger } from "../lib/logger";

/**
 * Returns the bulk discount percentage (0–100) for the given product + quantity.
 * Returns 0 if no active tier applies.
 *
 * Resolution order:
 *  1. Product-specific tier (productId matches) — checked first
 *  2. Global tier (productId IS NULL) — fallback
 *
 * A tier matches when:  minQty <= quantity  AND  (maxQty IS NULL OR quantity <= maxQty)
 */
export async function getBulkDiscount(productId: number, quantity: number): Promise<number> {
  try {
    const tiers = await db
      .select()
      .from(bulkPricingTiers)
      .where(
        and(
          or(eq(bulkPricingTiers.productId, productId), isNull(bulkPricingTiers.productId)),
          eq(bulkPricingTiers.isActive, true),
          lte(bulkPricingTiers.minQty, quantity),
        ),
      )
      .orderBy(bulkPricingTiers.minQty);

    // Filter to tiers where maxQty is null or >= quantity
    const matching = tiers.filter(
      (t) => t.maxQty === null || t.maxQty === undefined || t.maxQty >= quantity,
    );

    if (matching.length === 0) return 0;

    // Prefer product-specific tiers over global (productId = null) tiers.
    // Among ties, pick the highest discount.
    const productSpecific = matching.filter((t) => t.productId !== null);
    const candidates = productSpecific.length > 0 ? productSpecific : matching;

    // Return the highest discount percent from applicable candidates
    const best = candidates.reduce((max, t) => {
      const pct = parseFloat(t.discountPercent);
      return pct > max ? pct : max;
    }, 0);

    return best;
  } catch (err) {
    logger.warn({ err, productId, quantity }, "getBulkDiscount: DB lookup failed, returning 0");
    return 0;
  }
}
