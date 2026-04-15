import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  products, productVariants, categories,
  tags, productTags,
  attributeDefinitions, attributeOptions, productAttributes,
} from "@workspace/db/schema";
import {
  eq, ilike, and, sql, inArray, gt, asc, desc, count, or, type SQL,
} from "drizzle-orm";
import { z } from "zod";

const router = Router();

const browseSchema = z.object({
  q:      z.string().max(200).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  cat:    z.string().optional(),
  plat:   z.string().optional(),
  min:    z.coerce.number().min(0).optional(),
  max:    z.coerce.number().min(0).optional(),
  stock:  z.enum(["0", "1"]).optional(),
  sort:   z.string().optional(),
  tags:   z.string().optional(),
  attrs:  z.string().optional(),
});

router.get("/products", async (req: Request, res: Response) => {
  const parsed = browseSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const { q, limit, offset, cat, plat, min, max, stock, sort } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: SQL<any>[] = [eq(products.isActive, true)];

  // Full-text search
  if (q && q.trim().length > 0) {
    const pattern = `%${q.trim()}%`;
    const skuSub = db
      .selectDistinct({ productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.isActive, true), ilike(productVariants.sku, pattern)));
    const orClause = or(
      ilike(products.name, pattern),
      ilike(products.slug, pattern),
      ilike(products.description, pattern),
      ilike(products.shortDescription, pattern),
      inArray(products.id, skuSub),
    );
    if (orClause) conditions.push(orClause);
  }

  // Category filter
  if (cat) {
    const slugs = cat.split(",").filter(Boolean);
    if (slugs.length > 0) conditions.push(inArray(categories.slug, slugs) as ReturnType<typeof eq>);
  }

  // Tag filter (AND — every slug must match)
  const tagSlugs = (parsed.data.tags ?? "").split(",").filter(Boolean);
  for (const slug of tagSlugs) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM product_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.product_id = ${products.id} AND t.slug = ${slug}
      )`,
    );
  }

  // Attribute filter (AND across attrs, OR within options)
  const slugPattern = /^[a-z0-9_-]{1,100}$/;
  let attrsFilter: Record<string, string[]> = {};
  try { attrsFilter = JSON.parse(parsed.data.attrs ?? "{}"); } catch { /* ignore */ }
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
      )`,
    );
  }

  const whereClause = and(...conditions);

  // Variant-level filters (platform, price range, stock)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variantFilters: SQL<any>[] = [];
  if (plat) {
    const platforms = plat.split(",").filter(Boolean);
    if (platforms.length > 0) variantFilters.push(inArray(productVariants.platform, platforms));
  }
  if (min !== undefined) variantFilters.push(sql`COALESCE(${productVariants.priceOverrideUsd}, ${productVariants.priceUsd}) >= ${String(min)}`);
  if (max !== undefined) variantFilters.push(sql`COALESCE(${productVariants.priceOverrideUsd}, ${productVariants.priceUsd}) <= ${String(max)}`);
  if (stock === "1") variantFilters.push(gt(productVariants.stockCount, 0));

  let filteredProductIds: number[] | null = null;
  if (variantFilters.length > 0) {
    const varRows = await db
      .selectDistinct({ productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.isActive, true), ...variantFilters));
    filteredProductIds = varRows.map((r) => r.productId);
    if (filteredProductIds.length === 0) {
      res.json({ items: [], total: 0, limit, offset, facets: { tags: [], attributes: [] } });
      return;
    }

  }

  const fullWhere = filteredProductIds
    ? and(whereClause, inArray(products.id, filteredProductIds))
    : whereClause;

  // Get ALL matching IDs for facet computation (pre-pagination)
  const allMatchingRows = await db
    .select({ id: products.id })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(fullWhere);
  const allMatchingIds = allMatchingRows.map((r) => r.id);
  const total = allMatchingIds.length;

  // Sort
  const minPriceSub = sql`(SELECT MIN(COALESCE(pv.price_override_usd, pv.price_usd)) FROM product_variants pv WHERE pv.product_id = products.id AND pv.is_active = true)`;
  const orderClauses = [];
  switch (sort) {
    case "name-asc":   orderClauses.push(asc(products.name)); break;
    case "name-desc":  orderClauses.push(desc(products.name)); break;
    case "price-asc":  orderClauses.push(sql`${minPriceSub} ASC NULLS LAST`); break;
    case "price-desc": orderClauses.push(sql`${minPriceSub} DESC NULLS LAST`); break;
    case "featured":
      orderClauses.push(desc(products.isFeatured), desc(products.createdAt), desc(products.id));
      break;
    case "popular":
      orderClauses.push(desc(products.reviewCount));
      break;
    default:
      orderClauses.push(desc(products.createdAt), desc(products.id));
  }

  const results = await db
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
    .leftJoin(categories, eq(products.categoryId, categories.id))
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

  const items = results.map((p) => ({
    ...p,
    variants: variants.filter((v) => v.productId === p.id),
  }));

  const facets = await computeFacets(allMatchingIds);

  res.json({ items, total, limit, offset, facets });
});

router.get("/products/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      description: products.description,
      shortDescription: products.shortDescription,
      avgRating: products.avgRating,
      reviewCount: products.reviewCount,
      isFeatured: products.isFeatured,
      isNew: sql<boolean>`false`,
      regionRestrictions: products.regionRestrictions,
      platformType: products.platformType,
      categorySlug: categories.slug,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const product = rows[0];

  const variants = await db
    .select({
      id: productVariants.id,
      name: productVariants.name,
      sku: productVariants.sku,
      platform: productVariants.platform,
      priceUsd: productVariants.priceUsd,
      priceOverrideUsd: productVariants.priceOverrideUsd,
      compareAtPriceUsd: productVariants.compareAtPriceUsd,
      stockCount: productVariants.stockCount,
    })
    .from(productVariants)
    .where(and(eq(productVariants.productId, product.id), eq(productVariants.isActive, true)));

  res.json({
    ...product,
    avgRating: Number(product.avgRating),
    reviewCount: Number(product.reviewCount),
    variants: variants.map((v) => ({
      ...v,
      stockCount: Number(v.stockCount),
    })),
  });
});

async function computeFacets(productIds: number[]) {
  if (productIds.length === 0) return { tags: [], attributes: [] };

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

  const attrFacets = await db
    .select({
      attrId: attributeDefinitions.id,
      attrName: attributeDefinitions.name,
      attrSlug: attributeDefinitions.slug,
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
      attributeDefinitions.sortOrder,
      attributeOptions.id, attributeOptions.value, attributeOptions.slug,
      attributeOptions.colorHex, attributeOptions.sortOrder,
    )
    .orderBy(asc(attributeDefinitions.sortOrder), asc(attributeOptions.sortOrder));

  const attrMap = new Map<number, { id: number; name: string; slug: string; options: unknown[] }>();
  for (const row of attrFacets) {
    if (!attrMap.has(row.attrId)) {
      attrMap.set(row.attrId, { id: row.attrId, name: row.attrName, slug: row.attrSlug, options: [] });
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
