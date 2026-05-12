import { Router } from "express";
import { db } from "@workspace/db";
import { bundles, bundleItems, products, productVariants } from "@workspace/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";
import { paramString } from "../lib/route-params";
import { loadBundleForAnchor } from "../services/bundle-public";

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
      // Anchor product fallback fields — surfaced so the bundle listing card
      // can render the anchor's image when the bundle has no cover of its own.
      anchorImageUrl: products.imageUrl,
      anchorAvgRating: products.avgRating,
      anchorReviewCount: products.reviewCount,
    })
    .from(bundles)
    .leftJoin(products, eq(bundles.primaryProductId, products.id))
    .where(eq(bundles.isActive, true))
    .orderBy(asc(bundles.sortOrder), asc(bundles.id));

  const result = await Promise.all(
    rows.map(async (b) => {
      const items = await getBundleProducts(b.id);
      const individualTotal = items.reduce((s, i) => s + parseFloat(i.minPrice || "0"), 0);
      return {
        ...b,
        // Bundle's own cover takes precedence; fall back to the anchor's image.
        imageUrl: b.imageUrl ?? b.anchorImageUrl ?? null,
        items,
        individualTotal: individualTotal.toFixed(2),
      };
    }),
  );

  res.json(result);
});

router.get("/bundles/:slug", async (req, res) => {
  const [bundle] = await db
    .select()
    .from(bundles)
    .where(and(eq(bundles.slug, paramString(req.params, "slug")), eq(bundles.isActive, true)))
    .limit(1);

  if (!bundle) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }

  // Anchor product info — used by the storefront to render the bundle's hero
  // (image, name fallback, breadcrumbs) with the same layout as the PDP.
  const anchorId = bundle.primaryProductId;
  if (anchorId == null) {
    res.status(404).json({ error: "Bundle has no anchor product" });
    return;
  }
  const [anchor] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      galleryImages: products.galleryImages,
      description: products.description,
      shortDescription: products.shortDescription,
      regionRestrictions: products.regionRestrictions,
      avgRating: products.avgRating,
      reviewCount: products.reviewCount,
      keyFeatures: products.keyFeatures,
      systemRequirements: products.systemRequirements,
      platformType: products.platformType,
    })
    .from(products)
    .where(eq(products.id, anchorId))
    .limit(1);

  // Rich public bundle (components with allocated prices, savings, etc.)
  const publicBundle = await loadBundleForAnchor(anchorId);

  res.json({
    bundle: {
      id: bundle.id,
      slug: bundle.slug,
      name: bundle.name,
      description: bundle.description,
      shortDescription: bundle.shortDescription,
      imageUrl: bundle.imageUrl,
      metaTitle: bundle.metaTitle,
      metaDescription: bundle.metaDescription,
      public: publicBundle,
    },
    anchor: anchor ?? null,
  });
});

router.get("/bundles/by-product/:productId", async (req, res) => {
  const productId = parseInt(paramString(req.params, "productId"));
  if (isNaN(productId)) { res.json([]); return; }

  // Bundles to surface as an upsell on this product's PDP:
  //   1. bundles where this product is a component (bundle_items.product_id)
  //   2. bundles where this product is the anchor (bundles.primary_product_id)
  // Both need to surface so a standalone product page can still pitch the bundle.
  const [componentRows, anchorRows] = await Promise.all([
    db.select({ bundleId: bundleItems.bundleId })
      .from(bundleItems)
      .where(eq(bundleItems.productId, productId)),
    db.select({ id: bundles.id })
      .from(bundles)
      .where(eq(bundles.primaryProductId, productId)),
  ]);

  const bundleIds = [...new Set([
    ...componentRows.map((r) => r.bundleId),
    ...anchorRows.map((r) => r.id),
  ])];

  if (!bundleIds.length) { res.json([]); return; }

  const activeBundles = await db
    .select()
    .from(bundles)
    .where(and(inArray(bundles.id, bundleIds), eq(bundles.isActive, true)));

  const result = await Promise.all(
    activeBundles.map(async (b) => {
      const items = await getBundleProducts(b.id);
      const individualTotal = items.reduce((s, i) => s + parseFloat(i.minPrice || "0"), 0);
      return { ...b, items, individualTotal: individualTotal.toFixed(2) };
    }),
  );

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

  if (!items.length) return [];

  const productIds = items.map((i) => i.productId);
  const allVariants = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      priceUsd: productVariants.priceUsd,
      platform: productVariants.platform,
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)))
    .orderBy(asc(productVariants.priceUsd));

  // Group variants by productId, keeping up to 5 cheapest per product
  const variantsByProduct = new Map<number, typeof allVariants>();
  for (const v of allVariants) {
    const list = variantsByProduct.get(v.productId) ?? [];
    if (list.length < 5) list.push(v);
    variantsByProduct.set(v.productId, list);
  }

  return items.map((item) => {
    const variants = variantsByProduct.get(item.productId) ?? [];
    return { ...item, variants, minPrice: variants[0]?.priceUsd ?? "0" };
  });
}

export default router;
