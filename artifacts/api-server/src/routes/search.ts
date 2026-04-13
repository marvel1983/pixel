import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { products, productVariants, categories, tags, productTags, attributeDefinitions, attributeOptions, productAttributes } from "@workspace/db/schema";
import { eq, ilike, or, and, sql, inArray, gt, asc, desc, count, type SQL } from "drizzle-orm";
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

  // Tag filtering
  const tagSlugs = ((req.query.tags as string) ?? "").split(",").filter(Boolean);
  if (tagSlugs.length > 0) {
    for (const slug of tagSlugs) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM product_tags pt
          JOIN tags t ON t.id = pt.tag_id
          WHERE pt.product_id = ${products.id} AND t.slug = ${slug}
        )`
      );
    }
  }

  // Attribute filtering
  const slugPattern = /^[a-z0-9_-]{1,100}$/;
  let attrsFilter: Record<string, string[]> = {};
  try { attrsFilter = JSON.parse((req.query.attrs as string) ?? "{}"); } catch { /* invalid JSON — ignore */ }
  for (const [attrSlug, optionSlugs] of Object.entries(attrsFilter)) {
    if (!Array.isArray(optionSlugs) || optionSlugs.length === 0) continue;
    if (!slugPattern.test(attrSlug)) continue;
    const safeOptionSlugs = optionSlugs.map((s) => String(s)).filter((s) => slugPattern.test(s));
    if (safeOptionSlugs.length === 0) continue;
    const optionIdsSub = db
      .select({ id: attributeOptions.id })
      .from(attributeOptions)
      .innerJoin(attributeDefinitions, eq(attributeOptions.attributeId, attributeDefinitions.id))
      .where(and(eq(attributeDefinitions.slug, attrSlug), inArray(attributeOptions.slug, safeOptionSlugs)));
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM product_attributes pa
        WHERE pa.product_id = ${products.id}
          AND pa.option_id IN (${optionIdsSub})
      )`
    );
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
  if (min !== undefined) variantFilters.push(sql`COALESCE(${productVariants.priceOverrideUsd}, ${productVariants.priceUsd}) >= ${String(min)}`);
  if (max !== undefined) variantFilters.push(sql`COALESCE(${productVariants.priceOverrideUsd}, ${productVariants.priceUsd}) <= ${String(max)}`);
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

  const minPriceSub = sql`(SELECT MIN(COALESCE(pv.price_override_usd, pv.price_usd)) FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = true)`;
  const orderClauses = [];
  switch (sort) {
    case "name-asc": orderClauses.push(asc(products.name)); break;
    case "name-desc": orderClauses.push(desc(products.name)); break;
    case "price-asc": orderClauses.push(sql`${minPriceSub} ASC NULLS LAST`); break;
    case "price-desc": orderClauses.push(sql`${minPriceSub} DESC NULLS LAST`); break;
    case "newest": orderClauses.push(desc(products.createdAt), desc(products.id)); break;
    case "popular": orderClauses.push(desc(products.reviewCount)); break;
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
    platform: string | null; priceUsd: string; priceOverrideUsd: string | null;
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
        priceOverrideUsd: productVariants.priceOverrideUsd,
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

  const allIds = items.map((p: { id: number }) => p.id);
  const facets = await computeFacets(allIds);

  res.json({ items, total, limit, offset, facets });
});

async function computeFacets(productIds: number[]) {
  if (productIds.length === 0) return { tags: [], attributes: [] };

  // Tag facets
  const tagFacets = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      colorHex: tags.colorHex,
      count: count(productTags.productId),
    })
    .from(productTags)
    .innerJoin(tags, eq(productTags.tagId, tags.id))
    .where(inArray(productTags.productId, productIds))
    .groupBy(tags.id, tags.name, tags.slug, tags.colorHex)
    .orderBy(asc(tags.sortOrder));

  // Attribute facets (SELECT type only, filterable)
  const attrFacets = await db
    .select({
      attrId: attributeDefinitions.id,
      attrName: attributeDefinitions.name,
      attrSlug: attributeDefinitions.slug,
      attrType: attributeDefinitions.type,
      attrSort: attributeDefinitions.sortOrder,
      optId: attributeOptions.id,
      optValue: attributeOptions.value,
      optSlug: attributeOptions.slug,
      optColor: attributeOptions.colorHex,
      optSort: attributeOptions.sortOrder,
      cnt: count(productAttributes.productId),
    })
    .from(productAttributes)
    .innerJoin(attributeDefinitions, and(
      eq(productAttributes.attributeId, attributeDefinitions.id),
      eq(attributeDefinitions.isFilterable, true),
    ))
    .innerJoin(attributeOptions, eq(productAttributes.optionId, attributeOptions.id))
    .where(inArray(productAttributes.productId, productIds))
    .groupBy(
      attributeDefinitions.id, attributeDefinitions.name, attributeDefinitions.slug,
      attributeDefinitions.type, attributeDefinitions.sortOrder,
      attributeOptions.id, attributeOptions.value, attributeOptions.slug,
      attributeOptions.colorHex, attributeOptions.sortOrder,
    )
    .orderBy(asc(attributeDefinitions.sortOrder), asc(attributeOptions.sortOrder));

  // Group attribute facets by definition
  const attrMap = new Map<number, { id: number; name: string; slug: string; type: string; options: unknown[] }>();
  for (const row of attrFacets) {
    if (!attrMap.has(row.attrId)) {
      attrMap.set(row.attrId, { id: row.attrId, name: row.attrName, slug: row.attrSlug, type: row.attrType, options: [] });
    }
    attrMap.get(row.attrId)!.options.push({
      id: row.optId,
      value: row.optValue,
      slug: row.optSlug,
      colorHex: row.optColor,
      count: Number(row.cnt),
    });
  }

  return {
    tags: tagFacets.map((t) => ({ id: t.id, name: t.name, slug: t.slug, colorHex: t.colorHex, count: Number(t.count) })),
    attributes: Array.from(attrMap.values()),
  };
}

export default router;
