import { Router } from "express";
import { db } from "@workspace/db";
import { bundles, bundleItems, products, orderItems } from "@workspace/db/schema";
import { eq, asc, ilike, sql, and, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { z } from "zod/v4";
import { paramString } from "../lib/route-params";
import { validateBundleRule, pricePreviewFor, anchorCatalogPrice } from "../services/bundle-admin-helpers";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageProducts")];

const nullishStr = z.string().nullish().transform((v) => v ?? null);

const bundleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: nullishStr,
  shortDescription: nullishStr,
  imageUrl: nullishStr,
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: nullishStr,
  metaDescription: nullishStr,
  sortOrder: z.number().optional(),
  primaryProductId: z.number().int().positive(),
  productIds: z.array(z.number()).min(1),
  freeProductIds: z.array(z.number()).default([]),
  discountType: z.enum(["PERCENTAGE", "FIXED", "BUY_X_GET_Y_FREE"]),
  discountValue: z.string().default("0"),
  useAnchorPrice: z.boolean().optional().default(false),
});

router.get("/admin/bundles", ...auth, async (req, res) => {
  const search = (req.query.search as string) || "";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const where = search ? ilike(bundles.name, `%${search}%`) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(bundles).where(where)
      .orderBy(asc(bundles.sortOrder), desc(bundles.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(bundles).where(where),
  ]);

  const result = await Promise.all(
    rows.map(async (b) => {
      const items = await db
        .select({
          productId: bundleItems.productId,
          productName: products.name,
          productImage: products.imageUrl,
          productPrice: sql<string | null>`(SELECT MIN(price_usd::numeric)::text FROM product_variants WHERE product_id = ${bundleItems.productId} AND is_active = true)`,
          isFree: bundleItems.isFree,
          sortOrder: bundleItems.sortOrder,
        })
        .from(bundleItems)
        .innerJoin(products, eq(bundleItems.productId, products.id))
        .where(eq(bundleItems.bundleId, b.id))
        .orderBy(asc(bundleItems.sortOrder));
      return { ...b, items };
    }),
  );

  res.json({ bundles: result, total: count, page, pages: Math.ceil(count / limit) });
});

router.get("/admin/bundles/:id", ...auth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!bundle) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db
    .select({
      productId: bundleItems.productId,
      productName: products.name,
      productImage: products.imageUrl,
      productPrice: sql<string | null>`(SELECT MIN(price_usd::numeric)::text FROM product_variants WHERE product_id = ${bundleItems.productId} AND is_active = true)`,
      isFree: bundleItems.isFree,
      sortOrder: bundleItems.sortOrder,
    })
    .from(bundleItems)
    .innerJoin(products, eq(bundleItems.productId, products.id))
    .where(eq(bundleItems.bundleId, id))
    .orderBy(asc(bundleItems.sortOrder));

  res.json({
    ...bundle,
    productIds: items.map((i) => i.productId),
    freeProductIds: items.filter((i) => i.isFree).map((i) => i.productId),
    items,
  });
});

router.post("/admin/bundles/preview", ...auth, async (req, res) => {
  const parsed = bundleSchema.pick({ productIds: true, freeProductIds: true, primaryProductId: true, discountType: true, discountValue: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  if (d.productIds.includes(d.primaryProductId)) { res.status(400).json({ error: "Anchor must NOT be in productIds" }); return; }
  const pricing = await pricePreviewFor(d.productIds, d.freeProductIds, { discountType: d.discountType, discountValue: d.discountValue });
  res.json(pricing);
});

router.post("/admin/bundles", ...auth, async (req, res) => {
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const ruleError = await validateBundleRule(data);
  if (ruleError) { res.status(400).json({ error: ruleError }); return; }

  const pricing = await pricePreviewFor(data.productIds, data.freeProductIds, {
    discountType: data.discountType, discountValue: data.discountValue,
  });

  const { productIds, freeProductIds, primaryProductId, discountType, discountValue, useAnchorPrice, ...rest } = data;
  const freeSet = new Set(freeProductIds);
  const cachedPrice = useAnchorPrice ? (await anchorCatalogPrice(primaryProductId)) ?? pricing.finalUsd : pricing.finalUsd;

  const [bundle] = await db.insert(bundles).values({
    ...rest,
    primaryProductId, discountType, discountValue, useAnchorPrice,
    bundlePriceUsd: cachedPrice,
  }).returning();

  await db.update(products).set({ isBundleAnchor: true, updatedAt: new Date() }).where(eq(products.id, primaryProductId));

  if (productIds.length > 0) {
    await db.insert(bundleItems).values(
      productIds.map((pid, i) => ({
        bundleId: bundle.id,
        productId: pid,
        isFree: freeSet.has(pid),
        sortOrder: i,
      })),
    );
  }

  res.json({ ...bundle, pricing });
});

router.put("/admin/bundles/:id", ...auth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const ruleError = await validateBundleRule(data);
  if (ruleError) { res.status(400).json({ error: ruleError }); return; }

  const pricing = await pricePreviewFor(data.productIds, data.freeProductIds, {
    discountType: data.discountType, discountValue: data.discountValue,
  });

  const [oldBundle] = await db.select({ primaryProductId: bundles.primaryProductId }).from(bundles).where(eq(bundles.id, id)).limit(1);
  const { productIds, freeProductIds, primaryProductId, discountType, discountValue, useAnchorPrice, ...rest } = data;
  const freeSet = new Set(freeProductIds);
  const cachedPrice = useAnchorPrice ? (await anchorCatalogPrice(primaryProductId)) ?? pricing.finalUsd : pricing.finalUsd;

  const [updated] = await db.update(bundles).set({
    ...rest,
    primaryProductId, discountType, discountValue, useAnchorPrice,
    bundlePriceUsd: cachedPrice,
    updatedAt: new Date(),
  }).where(eq(bundles.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  await db.update(products).set({ isBundleAnchor: true, updatedAt: new Date() }).where(eq(products.id, primaryProductId));
  if (oldBundle && oldBundle.primaryProductId && oldBundle.primaryProductId !== primaryProductId) {
    const stillAnchored = await db.select({ id: bundles.id }).from(bundles)
      .where(and(eq(bundles.primaryProductId, oldBundle.primaryProductId), sql`${bundles.id} != ${id}`)).limit(1);
    if (stillAnchored.length === 0) {
      await db.update(products).set({ isBundleAnchor: false, updatedAt: new Date() }).where(eq(products.id, oldBundle.primaryProductId));
    }
  }

  await db.delete(bundleItems).where(eq(bundleItems.bundleId, id));
  if (productIds.length > 0) {
    await db.insert(bundleItems).values(
      productIds.map((pid, i) => ({
        bundleId: id,
        productId: pid,
        isFree: freeSet.has(pid),
        sortOrder: i,
      })),
    );
  }

  res.json({ ...updated, pricing });
});

router.delete("/admin/bundles/:id", ...auth, async (req, res) => {
  await db.delete(bundles).where(eq(bundles.id, parseInt(paramString(req.params, "id"))));
  res.json({ ok: true });
});

router.post("/admin/bundles/:id/duplicate", ...auth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  const [original] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!original) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));

  const [copy] = await db.insert(bundles).values({
    name: `${original.name} (Copy)`,
    slug: `${original.slug}-copy-${Date.now()}`,
    description: original.description,
    shortDescription: original.shortDescription,
    imageUrl: original.imageUrl,
    bundlePriceUsd: original.bundlePriceUsd,
    primaryProductId: original.primaryProductId,
    discountType: original.discountType,
    discountValue: original.discountValue,
    minPrimaryQty: original.minPrimaryQty,
    isActive: false,
    isFeatured: false,
    metaTitle: original.metaTitle,
    metaDescription: original.metaDescription,
    sortOrder: original.sortOrder,
  }).returning();

  if (items.length) {
    await db.insert(bundleItems).values(
      items.map((i) => ({ bundleId: copy.id, productId: i.productId, isFree: i.isFree, sortOrder: i.sortOrder })),
    );
  }

  res.json(copy);
});

router.get("/admin/bundles/:id/analytics", ...auth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!bundle) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select({ productId: bundleItems.productId })
    .from(bundleItems).where(eq(bundleItems.bundleId, id));

  const stats = await db.select({
    count: sql<number>`count(distinct ${orderItems.orderId})`,
    total: sql<string>`coalesce(sum(${orderItems.priceUsd} * ${orderItems.quantity}), 0)`,
  }).from(orderItems).where(eq(orderItems.bundleId, id));

  const purchases = Number(stats[0]?.count ?? 0);
  const revenue = parseFloat(stats[0]?.total ?? "0");

  res.json({ bundleId: id, name: bundle.name, itemCount: items.length, purchases, revenue: revenue.toFixed(2) });
});

export default router;
