import { eq, and, inArray, lte, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { flashSales, flashSaleProducts } from "@workspace/db/schema";

export interface FlashSaleInfo { salePriceUsd: string; soldCount: number; maxQuantity: number; flashSaleId: number }

export async function getFlashSaleInfo(variantIds: number[]): Promise<Map<number, FlashSaleInfo>> {
  if (variantIds.length === 0) return new Map();
  const now = new Date();
  const rows = await db.select({
    variantId: flashSaleProducts.variantId,
    salePriceUsd: flashSaleProducts.salePriceUsd,
    soldCount: flashSaleProducts.soldCount,
    maxQuantity: flashSaleProducts.maxQuantity,
    flashSaleId: flashSaleProducts.flashSaleId,
  }).from(flashSaleProducts)
    .innerJoin(flashSales, eq(flashSaleProducts.flashSaleId, flashSales.id))
    .where(and(
      inArray(flashSaleProducts.variantId, variantIds),
      eq(flashSales.status, "ACTIVE"),
      eq(flashSales.isActive, true),
      lte(flashSales.startsAt, now),
      gte(flashSales.endsAt, now),
    ));
  const map = new Map<number, FlashSaleInfo>();
  for (const r of rows) {
    if (r.soldCount < r.maxQuantity) map.set(r.variantId, r);
  }
  return map;
}
