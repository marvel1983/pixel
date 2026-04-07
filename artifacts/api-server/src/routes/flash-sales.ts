import { Router } from "express";
import { db } from "@workspace/db";
import { flashSales, flashSaleProducts, products, productVariants } from "@workspace/db/schema";
import { eq, and, lte, gte, sql, gt } from "drizzle-orm";

const router = Router();

function activeFlashSaleCondition() {
  const now = new Date();
  return and(
    eq(flashSales.isActive, true),
    eq(flashSales.status, "ACTIVE"),
    lte(flashSales.startsAt, now),
    gte(flashSales.endsAt, now)
  );
}

router.get("/flash-sales/active", async (_req, res) => {
  const rows = await db.select({
    id: flashSales.id,
    name: flashSales.name,
    slug: flashSales.slug,
    description: flashSales.description,
    bannerText: flashSales.bannerText,
    bannerColor: flashSales.bannerColor,
    startsAt: flashSales.startsAt,
    endsAt: flashSales.endsAt,
  })
    .from(flashSales)
    .where(activeFlashSaleCondition())
    .orderBy(flashSales.startsAt)
    .limit(1);

  if (rows.length === 0) {
    res.json({ sale: null });
    return;
  }

  const sale = rows[0];
  const items = await db.select({
    id: flashSaleProducts.id,
    productId: flashSaleProducts.productId,
    variantId: flashSaleProducts.variantId,
    salePriceUsd: flashSaleProducts.salePriceUsd,
    maxQuantity: flashSaleProducts.maxQuantity,
    soldCount: flashSaleProducts.soldCount,
    sortOrder: flashSaleProducts.sortOrder,
    productName: products.name,
    productSlug: products.slug,
    productImage: products.imageUrl,
    variantName: productVariants.name,
    originalPriceUsd: productVariants.priceUsd,
    platform: productVariants.platform,
  })
    .from(flashSaleProducts)
    .innerJoin(products, eq(flashSaleProducts.productId, products.id))
    .innerJoin(productVariants, eq(flashSaleProducts.variantId, productVariants.id))
    .where(eq(flashSaleProducts.flashSaleId, sale.id))
    .orderBy(flashSaleProducts.sortOrder);

  res.json({ sale: { ...sale, products: items } });
});

router.get("/flash-sales/check-variant/:variantId", async (req, res) => {
  const variantId = parseInt(req.params.variantId);
  if (isNaN(variantId)) { res.json({ flashSale: null }); return; }

  const now = new Date();
  const rows = await db.select({
    saleId: flashSales.id,
    saleName: flashSales.name,
    endsAt: flashSales.endsAt,
    salePriceUsd: flashSaleProducts.salePriceUsd,
    maxQuantity: flashSaleProducts.maxQuantity,
    soldCount: flashSaleProducts.soldCount,
  })
    .from(flashSaleProducts)
    .innerJoin(flashSales, eq(flashSaleProducts.flashSaleId, flashSales.id))
    .where(and(
      eq(flashSaleProducts.variantId, variantId),
      eq(flashSales.isActive, true),
      eq(flashSales.status, "ACTIVE"),
      lte(flashSales.startsAt, now),
      gte(flashSales.endsAt, now),
      gt(sql`${flashSaleProducts.maxQuantity} - ${flashSaleProducts.soldCount}`, 0)
    ))
    .limit(1);

  res.json({ flashSale: rows[0] ?? null });
});

router.get("/flash-sales/banner", async (_req, res) => {
  const rows = await db.select({
    id: flashSales.id,
    name: flashSales.name,
    slug: flashSales.slug,
    bannerText: flashSales.bannerText,
    bannerColor: flashSales.bannerColor,
    endsAt: flashSales.endsAt,
  })
    .from(flashSales)
    .where(activeFlashSaleCondition())
    .limit(1);

  res.json({ banner: rows[0] ?? null });
});

export default router;
