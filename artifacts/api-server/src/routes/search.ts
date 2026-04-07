import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { products, productVariants, categories } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, inArray, gte, lte, gt, asc, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  cat: z.string().optional(),
  plat: z.string().optional(),
  min: z.coerce.number().min(0).optional(),
  max: z.coerce.number().min(0).optional(),
  stock: z.enum(["0", "1"]).optional(),
  sort: z.string().optional(),
});

router.get("/search", async (req: Request, res: Response) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search parameters" });
    return;
  }

  const { q, limit, offset, cat, plat, min, max, stock, sort } = parsed.data;
  const pattern = `%${q}%`;

  const skuSub = db
    .selectDistinct({ productId: productVariants.productId })
    .from(productVariants)
    .where(and(eq(productVariants.isActive, true), ilike(productVariants.sku, pattern)));

  const conditions = [
    eq(products.isActive, true),
    or(
      ilike(products.name, pattern),
      ilike(products.slug, pattern),
      ilike(products.description, pattern),
      ilike(products.shortDescription, pattern),
      inArray(products.id, skuSub),
    ),
  ];

  if (cat) {
    const slugs = cat.split(",").filter(Boolean);
    if (slugs.length > 0) {
      conditions.push(inArray(categories.slug, slugs));
    }
  }

  const whereClause = and(...conditions);

  const baseQuery = db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      avgRating: products.avgRating,
      reviewCount: products.reviewCount,
      isFeatured: products.isFeatured,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id));

  const variantFilters = [];
  if (plat) {
    const platforms = plat.split(",").filter(Boolean);
    if (platforms.length > 0) variantFilters.push(inArray(productVariants.platform, platforms));
  }
  if (min !== undefined) variantFilters.push(gte(productVariants.priceUsd, String(min)));
  if (max !== undefined) variantFilters.push(lte(productVariants.priceUsd, String(max)));
  if (stock === "1") variantFilters.push(gt(productVariants.stockCount, 0));

  const hasVarFilters = variantFilters.length > 0;

  let filteredProductIds: number[] | null = null;
  if (hasVarFilters) {
    const varRows = await db
      .selectDistinct({ productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.isActive, true), ...variantFilters));
    filteredProductIds = varRows.map((r) => r.productId);
    if (filteredProductIds.length === 0) {
      res.json({ items: [], total: 0, limit, offset });
      return;
    }
  }

  const fullWhere = filteredProductIds
    ? and(whereClause, inArray(products.id, filteredProductIds))
    : whereClause;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(fullWhere);

  const minPriceSub = sql`(SELECT MIN(pv.price_usd) FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = true)`;
  const orderClauses = [];
  switch (sort) {
    case "name-asc": orderClauses.push(asc(products.name)); break;
    case "name-desc": orderClauses.push(desc(products.name)); break;
    case "price-asc": orderClauses.push(sql`${minPriceSub} ASC NULLS LAST`); break;
    case "price-desc": orderClauses.push(sql`${minPriceSub} DESC NULLS LAST`); break;
    default:
      orderClauses.push(
        sql`CASE WHEN ${products.name} ILIKE ${pattern} THEN 0 ELSE 1 END`,
        asc(products.name),
      );
  }

  const results = await baseQuery
    .where(fullWhere)
    .orderBy(...orderClauses)
    .limit(limit)
    .offset(offset);

  const productIds = results.map((r) => r.id);
  let variants: {
    id: number; productId: number; name: string; sku: string;
    platform: string | null; priceUsd: string;
    compareAtPriceUsd: string | null; stockCount: number;
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
      .where(and(eq(productVariants.isActive, true), inArray(productVariants.productId, productIds)));
  }

  const total = countResult?.count ?? 0;
  const items = results.map((p) => ({
    ...p,
    variants: variants.filter((v) => v.productId === p.id),
  }));

  res.json({ items, total, limit, offset });
});

export default router;
