import { Router } from "express";
import { db } from "@workspace/db";
import { products, productVariants } from "@workspace/db/schema";
import { eq, and, not, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

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
