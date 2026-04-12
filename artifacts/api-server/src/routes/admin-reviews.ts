import { Router } from "express";
import { db } from "@workspace/db";
import { reviews, products, users } from "@workspace/db/schema";
import { eq, desc, sql, and, or, ilike, gte, lte, count, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { awardReviewBonus } from "../services/loyalty-service";
import { logger } from "../lib/logger";
import { paramString } from "../lib/route-params";

const router = Router();

router.get("/admin/reviews", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;
  const conditions = buildFilters(req.query);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(reviews).where(where);

  const [pendingR] = await db.select({ cnt: count() }).from(reviews).where(eq(reviews.status, "PENDING"));
  const [approvedR] = await db.select({ cnt: count() }).from(reviews).where(eq(reviews.status, "APPROVED"));
  const [rejectedR] = await db.select({ cnt: count() }).from(reviews).where(eq(reviews.status, "REJECTED"));
  const [avgR] = await db.select({ avg: sql<string>`COALESCE(AVG(${reviews.rating}), 0)` }).from(reviews);

  const rows = await db.select({
    id: reviews.id, productId: reviews.productId, userId: reviews.userId,
    rating: reviews.rating, title: reviews.title, body: reviews.body,
    ratingGameplay: reviews.ratingGameplay, ratingGraphics: reviews.ratingGraphics,
    ratingValue: reviews.ratingValue, ratingSupport: reviews.ratingSupport,
    isVerifiedPurchase: reviews.isVerifiedPurchase, isApproved: reviews.isApproved,
    status: reviews.status, helpfulCount: reviews.helpfulCount,
    adminReply: reviews.adminReply, adminReplyAt: reviews.adminReplyAt,
    createdAt: reviews.createdAt,
    productName: products.name, productSlug: products.slug,
    userEmail: users.email, userFirstName: users.firstName, userLastName: users.lastName,
  }).from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(where)
    .orderBy(desc(reviews.createdAt))
    .limit(limit).offset(offset);

  res.json({
    reviews: rows, total, page, limit,
    stats: {
      pending: Number(pendingR.cnt), approved: Number(approvedR.cnt),
      rejected: Number(rejectedR.cnt), avgRating: parseFloat(avgR.avg),
    },
  });
});

router.get("/admin/reviews/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [review] = await db.select({
    id: reviews.id, productId: reviews.productId, userId: reviews.userId,
    rating: reviews.rating, title: reviews.title, body: reviews.body,
    ratingGameplay: reviews.ratingGameplay, ratingGraphics: reviews.ratingGraphics,
    ratingValue: reviews.ratingValue, ratingSupport: reviews.ratingSupport,
    isVerifiedPurchase: reviews.isVerifiedPurchase, isApproved: reviews.isApproved,
    status: reviews.status, helpfulCount: reviews.helpfulCount,
    adminReply: reviews.adminReply, adminReplyAt: reviews.adminReplyAt,
    createdAt: reviews.createdAt, updatedAt: reviews.updatedAt,
    productName: products.name, productSlug: products.slug,
    userEmail: users.email, userFirstName: users.firstName, userLastName: users.lastName,
  }).from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .innerJoin(users, eq(reviews.userId, users.id))
    .where(eq(reviews.id, id));

  if (!review) { res.status(404).json({ error: "Review not found" }); return; }
  res.json({ review });
});

router.patch("/admin/reviews/:id/status", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { status } = req.body;
  if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  const isApproved = status === "APPROVED";
  await db.update(reviews).set({ status, isApproved, updatedAt: new Date() }).where(eq(reviews.id, id));
  if (isApproved) {
    const [review] = await db.select({ userId: reviews.userId }).from(reviews).where(eq(reviews.id, id)).limit(1);
    if (review?.userId) {
      awardReviewBonus(review.userId, id).catch((err) =>
        logger.error({ err, reviewId: id }, "Failed to award review loyalty bonus (non-fatal)"),
      );
    }
  }
  res.json({ success: true });
});

router.patch("/admin/reviews/:id/reply", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { reply } = req.body;
  if (typeof reply !== "string") { res.status(400).json({ error: "Reply text required" }); return; }
  const adminReply = reply.trim() || null;
  const adminReplyAt = adminReply ? new Date() : null;
  await db.update(reviews).set({ adminReply, adminReplyAt, updatedAt: new Date() }).where(eq(reviews.id, id));
  res.json({ success: true });
});

router.delete("/admin/reviews/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(reviews).where(eq(reviews.id, id));
  res.json({ success: true });
});

router.post("/admin/reviews/bulk", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const { ids, action } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "No IDs provided" }); return; }
  const intIds = ids.map(Number).filter(Number.isInteger);
  if (intIds.length === 0) { res.status(400).json({ error: "Invalid IDs" }); return; }

  if (action === "approve") {
    await db.update(reviews).set({ status: "APPROVED", isApproved: true, updatedAt: new Date() }).where(inArray(reviews.id, intIds));
  } else if (action === "reject") {
    await db.update(reviews).set({ status: "REJECTED", isApproved: false, updatedAt: new Date() }).where(inArray(reviews.id, intIds));
  } else if (action === "delete") {
    await db.delete(reviews).where(inArray(reviews.id, intIds));
  } else {
    res.status(400).json({ error: "Invalid action. Use: approve, reject, delete" }); return;
  }
  res.json({ success: true, affected: intIds.length });
});

function buildFilters(query: Record<string, unknown>) {
  const conditions = [];
  const status = query.status as string | undefined;
  if (status && status !== "ALL") conditions.push(eq(reviews.status, status as "PENDING" | "APPROVED" | "REJECTED"));
  const rating = query.rating as string | undefined;
  if (rating && rating !== "ALL") conditions.push(eq(reviews.rating, Number(rating)));
  const search = query.search as string | undefined;
  if (search?.trim()) conditions.push(or(ilike(products.name, `%${search}%`), ilike(reviews.title, `%${search}%`), ilike(reviews.body, `%${search}%`)));
  const from = query.from as string | undefined;
  if (from) conditions.push(gte(reviews.createdAt, new Date(from)));
  const to = query.to as string | undefined;
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); conditions.push(lte(reviews.createdAt, d)); }
  const verified = query.verified as string | undefined;
  if (verified === "true") conditions.push(eq(reviews.isVerifiedPurchase, true));
  return conditions;
}

export default router;
