import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, or, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  reviews,
  products,
  productVariants,
  orderItems,
  orders,
  users,
  loyaltyAccounts,
} from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { paramString } from "../lib/route-params";

const router = Router();

const createReviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional().nullable(),
  body: z.string().min(1).max(5000),
});

/** Public: approved reviews for a product (for storefront). */
router.get("/products/:productId/reviews", async (req, res) => {
  const productId = Number(paramString(req.params, "productId"));
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: "Invalid product" });
    return;
  }

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      helpfulCount: reviews.helpfulCount,
      createdAt: reviews.createdAt,
      adminReply: reviews.adminReply,
      adminReplyAt: reviews.adminReplyAt,
      firstName: users.firstName,
      lastName: users.lastName,
      reviewerTier: loyaltyAccounts.tier,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.userId, users.id))
    .leftJoin(loyaltyAccounts, eq(loyaltyAccounts.userId, reviews.userId))
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "APPROVED")))
    .orderBy(desc(reviews.createdAt));

  const [agg] = await db
    .select({
      avg: sql<string>`COALESCE(ROUND(AVG(${reviews.rating})::numeric, 1), 0)`,
      cnt: count(),
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "APPROVED")));

  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt,
      adminReply: r.adminReply,
      adminReplyAt: r.adminReplyAt,
      author: [r.firstName, r.lastName].filter(Boolean).join(" ") || "Customer",
      reviewerTier: r.reviewerTier ?? null,
    })),
    avgRating: parseFloat(agg?.avg ?? "0"),
    reviewCount: Number(agg?.cnt ?? 0),
  });
});

/** Authenticated customer (or any logged-in user): submit review for moderation. */
router.post("/reviews", requireAuth, async (req, res) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid review data" });
    return;
  }

  const { productId, rating, title, body } = parsed.data;
  const userId = req.user!.userId;

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [duplicate] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.userId, userId),
        eq(reviews.productId, productId),
        or(eq(reviews.status, "PENDING"), eq(reviews.status, "APPROVED")),
      ),
    )
    .limit(1);
  if (duplicate) {
    res.status(409).json({ error: "You already have a review for this product (pending or published)." });
    return;
  }

  const [purchase] = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.status, "COMPLETED"),
        eq(productVariants.productId, productId),
      ),
    )
    .limit(1);

  const titleTrim = title?.trim() || null;

  const [inserted] = await db
    .insert(reviews)
    .values({
      productId,
      userId,
      rating,
      title: titleTrim,
      body: body.trim(),
      status: "PENDING",
      isApproved: false,
      isVerifiedPurchase: !!purchase,
    })
    .returning({ id: reviews.id });

  res.status(201).json({
    success: true,
    id: inserted.id,
    message: "Thank you. Your review will appear after moderation.",
  });
});

export default router;
