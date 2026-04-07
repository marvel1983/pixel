import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { products, productVariants } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/search", async (req: Request, res: Response) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search parameters" });
    return;
  }

  const { q, limit, offset } = parsed.data;
  const pattern = `%${q}%`;

  const skuMatchSubquery = db
    .selectDistinct({ productId: productVariants.productId })
    .from(productVariants)
    .where(and(eq(productVariants.isActive, true), ilike(productVariants.sku, pattern)));

  const whereClause = and(
    eq(products.isActive, true),
    or(
      ilike(products.name, pattern),
      ilike(products.slug, pattern),
      ilike(products.description, pattern),
      ilike(products.shortDescription, pattern),
      inArray(products.id, skuMatchSubquery),
    ),
  );

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(whereClause);

  const results = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      avgRating: products.avgRating,
      reviewCount: products.reviewCount,
      isFeatured: products.isFeatured,
      categoryId: products.categoryId,
    })
    .from(products)
    .where(whereClause)
    .orderBy(
      sql`CASE WHEN ${products.name} ILIKE ${pattern} THEN 0 ELSE 1 END`,
      products.name,
    )
    .limit(limit)
    .offset(offset);

  const productIds = results.map((r) => r.id);

  let variants: {
    id: number;
    productId: number;
    name: string;
    sku: string;
    platform: string | null;
    priceUsd: string;
    compareAtPriceUsd: string | null;
    stockCount: number;
  }[] = [];

  if (productIds.length > 0) {
    variants = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        name: productVariants.name,
        sku: productVariants.sku,
        platform: productVariants.platform,
        priceUsd: productVariants.priceUsd,
        compareAtPriceUsd: productVariants.compareAtPriceUsd,
        stockCount: productVariants.stockCount,
      })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.isActive, true),
          inArray(productVariants.productId, productIds),
        ),
      );
  }

  const total = countResult?.count ?? 0;
  const items = results.map((p) => ({
    ...p,
    variants: variants.filter((v) => v.productId === p.id),
  }));

  res.json({ items, total, limit, offset });
});

export default router;
