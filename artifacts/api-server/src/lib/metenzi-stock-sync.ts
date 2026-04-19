import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { metenziProductMappings, productVariants, products } from "@workspace/db/schema";
import { getMetenziConfig } from "./metenzi-config";
import { getProducts } from "./metenzi-endpoints";
import { logger } from "./logger";

export interface StockSyncResult {
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Syncs stock for all Metenzi mappings that have autoSyncStock=true.
 * Fetches the full product list from Metenzi once and updates all matching variants.
 */
export async function syncMetenziStock(): Promise<StockSyncResult> {
  const result: StockSyncResult = { updated: 0, skipped: 0, errors: 0 };

  const config = await getMetenziConfig();
  if (!config) {
    logger.debug("Metenzi stock sync skipped: not configured");
    return result;
  }

  // Fetch all mappings with autoSyncStock enabled
  const mappings = await db
    .select({
      id: metenziProductMappings.id,
      metenziProductId: metenziProductMappings.metenziProductId,
      pixelProductId: metenziProductMappings.pixelProductId,
    })
    .from(metenziProductMappings)
    .where(eq(metenziProductMappings.autoSyncStock, true));

  if (mappings.length === 0) {
    return result;
  }

  // Fetch all Metenzi products in one request
  let metenziProducts;
  try {
    metenziProducts = await getProducts(config);
  } catch (err) {
    logger.error({ err }, "Metenzi stock sync: failed to fetch products from Metenzi");
    result.errors = mappings.length;
    return result;
  }

  const metenziMap = new Map(metenziProducts.map((p) => [p.id, p]));

  for (const mapping of mappings) {
    if (!mapping.pixelProductId) {
      result.skipped++;
      continue;
    }

    const mp = metenziMap.get(mapping.metenziProductId);
    if (!mp) {
      result.skipped++;
      continue;
    }

    try {
      // Update the first variant's stockCount for this product
      const [variant] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.productId, mapping.pixelProductId))
        .limit(1);

      if (!variant) {
        result.skipped++;
        continue;
      }

      const eta = mp.estimatedRestockDate ?? mp.backorderEta ?? mp.restockEta ?? null;
      await db
        .update(productVariants)
        .set({ stockCount: mp.stock, backorderAllowed: true, backorderEta: eta, updatedAt: new Date() })
        .where(eq(productVariants.id, variant.id));

      if (mp.instructions !== undefined) {
        await db
          .update(products)
          .set({ activationInstructions: mp.instructions ?? null, updatedAt: new Date() })
          .where(eq(products.id, mapping.pixelProductId));
      }

      await db
        .update(metenziProductMappings)
        .set({ lastStockSyncAt: new Date(), updatedAt: new Date() })
        .where(eq(metenziProductMappings.id, mapping.id));

      result.updated++;
    } catch (err) {
      logger.error({ err, mappingId: mapping.id }, "Metenzi stock sync: failed to update variant");
      result.errors++;
    }
  }

  return result;
}
