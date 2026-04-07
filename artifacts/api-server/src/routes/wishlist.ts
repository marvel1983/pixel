import { Router } from "express";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { wishlists, products, productVariants } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/wishlist", requireAuth, async (req, res) => {
  try {
    const items = await db
      .select({ productId: wishlists.productId, createdAt: wishlists.createdAt })
      .from(wishlists)
      .where(eq(wishlists.userId, req.user!.userId));

    res.json({ items });
  } catch (err) {
    logger.error({ err }, "Failed to fetch wishlist");
    res.status(500).json({ error: "Failed to fetch wishlist" });
  }
});

const addSchema = z.object({ productId: z.number().int().positive() });

router.post("/wishlist", requireAuth, async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid product ID is required" });
    return;
  }

  try {
    await db
      .insert(wishlists)
      .values({ userId: req.user!.userId, productId: parsed.data.productId })
      .onConflictDoNothing();

    res.status(201).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to add to wishlist");
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

router.delete("/wishlist/:productId", requireAuth, async (req, res) => {
  const raw = req.params.productId;
  const productId = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  if (isNaN(productId) || productId <= 0) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  try {
    await db
      .delete(wishlists)
      .where(
        and(
          eq(wishlists.userId, req.user!.userId),
          eq(wishlists.productId, productId),
        ),
      );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to remove from wishlist");
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

const syncSchema = z.object({
  productIds: z.array(z.number().int().positive()).max(200),
});

router.post("/wishlist/sync", requireAuth, async (req, res) => {
  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Product IDs array required" });
    return;
  }

  try {
    const existing = await db
      .select({ productId: wishlists.productId })
      .from(wishlists)
      .where(eq(wishlists.userId, req.user!.userId));

    const existingIds = new Set(existing.map((e) => e.productId));
    const toInsert = parsed.data.productIds.filter((id) => !existingIds.has(id));

    if (toInsert.length > 0) {
      await db.insert(wishlists).values(
        toInsert.map((productId) => ({
          userId: req.user!.userId,
          productId,
        })),
      ).onConflictDoNothing();
    }

    const allItems = await db
      .select({ productId: wishlists.productId })
      .from(wishlists)
      .where(eq(wishlists.userId, req.user!.userId));

    res.json({ productIds: allItems.map((i) => i.productId) });
  } catch (err) {
    logger.error({ err }, "Failed to sync wishlist");
    res.status(500).json({ error: "Failed to sync wishlist" });
  }
});

const idsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(50),
});

router.post("/products/by-ids", async (req, res) => {
  const parsed = idsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Product IDs array required" });
    return;
  }

  try {
    const prods = await db
      .select()
      .from(products)
      .where(inArray(products.id, parsed.data.ids));

    const variants = await db
      .select()
      .from(productVariants)
      .where(inArray(productVariants.productId, parsed.data.ids));

    const result = prods.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl: p.imageUrl,
      categorySlug: "",
      avgRating: parseFloat(p.avgRating ?? "0"),
      reviewCount: p.reviewCount,
      type: p.type,
      shortDescription: p.shortDescription,
      isFeatured: p.isFeatured,
      isNew: false,
      variants: variants
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          platform: v.platform ?? "OTHER",
          priceUsd: v.priceUsd,
          compareAtPriceUsd: v.compareAtPriceUsd,
          stockCount: v.stockCount,
        })),
    }));

    res.json({ products: result });
  } catch (err) {
    logger.error({ err }, "Failed to fetch products by IDs");
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

export default router;
