import { Router } from "express";
import { db } from "@workspace/db";
import { bundles, bundleItems, products, productVariants } from "@workspace/db/schema";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

router.get("/bundles", async (_req, res) => {
  const rows = await db
    .select({
      id: bundles.id,
      name: bundles.name,
      slug: bundles.slug,
      shortDescription: bundles.shortDescription,
      imageUrl: bundles.imageUrl,
      bundlePriceUsd: bundles.bundlePriceUsd,
      isFeatured: bundles.isFeatured,
      sortOrder: bundles.sortOrder,
    })
    .from(bundles)
    .where(eq(bundles.isActive, true))
    .orderBy(asc(bundles.sortOrder), asc(bundles.id));

  const result = await Promise.all(
    rows.map(async (b) => {
      const items = await getBundleProducts(b.id);
      const individualTotal = items.reduce((s, i) => s + parseFloat(i.minPrice || "0"), 0);
      return { ...b, items, individualTotal: individualTotal.toFixed(2) };
    }),
  );

  res.json(result);
});

router.get("/bundles/:slug", async (req, res) => {
  const [bundle] = await db
    .select()
    .from(bundles)
    .where(and(eq(bundles.slug, req.params.slug), eq(bundles.isActive, true)))
    .limit(1);

  if (!bundle) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }

  const items = await getBundleProducts(bundle.id);
  const individualTotal = items.reduce((s, i) => s + parseFloat(i.minPrice || "0"), 0);

  res.json({
    ...bundle,
    items,
    individualTotal: individualTotal.toFixed(2),
  });
});

router.get("/bundles/by-product/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) { res.json([]); return; }

  const rows = await db
    .select({ bundleId: bundleItems.bundleId })
    .from(bundleItems)
    .where(eq(bundleItems.productId, productId));

  if (!rows.length) { res.json([]); return; }

  const bundleIds = rows.map((r) => r.bundleId);
  const result: any[] = [];
  for (const bid of bundleIds) {
    const [b] = await db.select().from(bundles)
      .where(and(eq(bundles.id, bid), eq(bundles.isActive, true))).limit(1);
    if (!b) continue;
    const items = await getBundleProducts(b.id);
    const individualTotal = items.reduce((s, i) => s + parseFloat(i.minPrice || "0"), 0);
    result.push({ ...b, items, individualTotal: individualTotal.toFixed(2) });
  }

  res.json(result);
});

async function getBundleProducts(bundleId: number) {
  const items = await db
    .select({
      id: bundleItems.id,
      productId: bundleItems.productId,
      sortOrder: bundleItems.sortOrder,
      productName: products.name,
      productSlug: products.slug,
      productImage: products.imageUrl,
    })
    .from(bundleItems)
    .innerJoin(products, eq(bundleItems.productId, products.id))
    .where(eq(bundleItems.bundleId, bundleId))
    .orderBy(asc(bundleItems.sortOrder));

  return Promise.all(
    items.map(async (item) => {
      const variants = await db
        .select({
          id: productVariants.id,
          name: productVariants.name,
          priceUsd: productVariants.priceUsd,
          platform: productVariants.platform,
        })
        .from(productVariants)
        .where(and(eq(productVariants.productId, item.productId), eq(productVariants.isActive, true)))
        .orderBy(asc(productVariants.priceUsd))
        .limit(5);
      const minPrice = variants[0]?.priceUsd ?? "0";
      return { ...item, variants, minPrice };
    }),
  );
}

export default router;
