import { Router } from "express";
import { db } from "@workspace/db";
import { products, productVariants, siteSettings } from "@workspace/db/schema";
import { eq, and, not, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// Public endpoint — returns CPP and processing fee config for checkout UI
router.get("/checkout/config", async (_req, res) => {
  const [s] = await db.select({
    cppEnabled: siteSettings.cppEnabled,
    cppLabel: siteSettings.cppLabel,
    cppPrice: siteSettings.cppPrice,
    cppDescription: siteSettings.cppDescription,
    processingFeePercent: siteSettings.processingFeePercent,
    processingFeeFixed: siteSettings.processingFeeFixed,
  }).from(siteSettings);
  res.json({
    cppEnabled: s?.cppEnabled ?? false,
    cppLabel: s?.cppLabel ?? "Checkout Protection Plan",
    cppPrice: s?.cppPrice ?? "0.99",
    cppDescription: s?.cppDescription ?? "",
    processingFeePercent: s?.processingFeePercent ?? "0",
    processingFeeFixed: s?.processingFeeFixed ?? "0",
  });
});

router.get("/checkout/offers", async (req, res) => {
  const excludeIdsParam = req.query.exclude;
  const excludeIds: number[] = [];

  if (typeof excludeIdsParam === "string" && excludeIdsParam) {
    excludeIdsParam.split(",").forEach((id) => {
      const n = parseInt(id, 10);
      if (!isNaN(n)) excludeIds.push(n);
    });
  }

  try {
    const query = db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        imageUrl: products.imageUrl,
        variantId: productVariants.id,
        variantName: productVariants.name,
        priceUsd: productVariants.priceUsd,
        platform: productVariants.platform,
      })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(products.isActive, true),
          eq(products.isFeatured, true),
          ...(excludeIds.length > 0
            ? [not(inArray(products.id, excludeIds))]
            : []),
        ),
      )
      .limit(2);

    const offers = await query;

    res.json({
      offers: offers.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        imageUrl: o.imageUrl,
        variantId: o.variantId,
        variantName: o.variantName,
        priceUsd: o.priceUsd,
        platform: o.platform,
      })),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch checkout offers");
    res.json({ offers: [] });
  }
});

export default router;
