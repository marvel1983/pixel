import { Router } from "express";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  products,
  productVariants,
  reviews,
  users,
  productQuestions,
  supportTickets,
} from "@workspace/db/schema";
import { eq, sql, and, gte, lte, count, sum, desc, lt, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getBalance } from "../lib/metenzi-endpoints";
import { paramString } from "../lib/route-params";

const router = Router();

router.get(
  "/admin/dashboard/stats",
  requireAuth,
  requireAdmin,
  requirePermission("viewAnalytics"),
  async (_req, res) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayStats] = await db
      .select({
        count: count(),
        revenue: sum(orders.totalUsd),
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, todayStart),
          lte(orders.createdAt, now),
        ),
      );

    const [monthStats] = await db
      .select({
        count: count(),
        revenue: sum(orders.totalUsd),
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, monthStart),
          lte(orders.createdAt, now),
        ),
      );

    const [activeProducts] = await db
      .select({ count: count() })
      .from(products)
      .where(eq(products.isActive, true));

    const [pendingOrders] = await db
      .select({ count: count() })
      .from(orders)
      .where(eq(orders.status, "PENDING"));

    const [pendingQA] = await db
      .select({ count: count() })
      .from(productQuestions)
      .where(eq(productQuestions.status, "PENDING"));

    const [openTickets] = await db
      .select({ count: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, "OPEN"));

    let metenziBalance: number | null = null;
    try {
      const config = await getMetenziConfig();
      if (config) {
        const balance = await getBalance(config);
        metenziBalance = parseFloat(balance.balance);
      }
    } catch {
      metenziBalance = null;
    }

    res.json({
      todayOrders: todayStats?.count ?? 0,
      todayRevenue: Number(todayStats?.revenue ?? 0),
      monthOrders: monthStats?.count ?? 0,
      monthRevenue: Number(monthStats?.revenue ?? 0),
      activeProducts: activeProducts?.count ?? 0,
      pendingOrders: pendingOrders?.count ?? 0,
      pendingQA: pendingQA?.count ?? 0,
      openTickets: openTickets?.count ?? 0,
      metenziBalance,
    });
  },
);

router.get(
  "/admin/dashboard/recent-orders",
  requireAuth,
  requireAdmin,
  requirePermission("viewAnalytics"),
  async (_req, res) => {
    const recentOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerEmail: sql<string>`COALESCE(${users.email}, ${orders.guestEmail}, 'Unknown')`,
        customerName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${orders.guestEmail}, 'Guest')`,
        totalUsd: orders.totalUsd,
        status: orders.status,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .orderBy(desc(orders.createdAt))
      .limit(10);

    const orderIds = recentOrders.map((o) => o.id);
    let itemsByOrder: Record<number, string[]> = {};
    if (orderIds.length > 0) {
      const items = await db
        .select({
          orderId: orderItems.orderId,
          productName: orderItems.productName,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));
      for (const item of items) {
        if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
        itemsByOrder[item.orderId].push(item.productName);
      }
    }

    res.json({
      orders: recentOrders.map((o) => ({
        ...o,
        totalUsd: Number(o.totalUsd),
        products: itemsByOrder[o.id] ?? [],
      })),
    });
  },
);

router.get(
  "/admin/dashboard/low-stock",
  requireAuth,
  requireAdmin,
  requirePermission("viewAnalytics"),
  async (_req, res) => {
    const lowStock = await db
      .select({
        variantId: productVariants.id,
        productName: products.name,
        variantName: productVariants.name,
        sku: productVariants.sku,
        stockCount: productVariants.stockCount,
        lowStockThreshold: productVariants.lowStockThreshold,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          eq(productVariants.isActive, true),
          lt(productVariants.stockCount, 5),
        ),
      )
      .orderBy(productVariants.stockCount)
      .limit(20);

    res.json({ items: lowStock });
  },
);

router.get(
  "/admin/dashboard/pending-reviews",
  requireAuth,
  requireAdmin,
  requirePermission("viewAnalytics"),
  async (_req, res) => {
    const pending = await db
      .select({
        id: reviews.id,
        productName: products.name,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
        rating: reviews.rating,
        title: reviews.title,
        body: reviews.body,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .innerJoin(products, eq(reviews.productId, products.id))
      .innerJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.status, "PENDING"))
      .orderBy(desc(reviews.createdAt))
      .limit(5);

    res.json({ reviews: pending });
  },
);

router.post(
  "/admin/dashboard/reviews/:id/approve",
  requireAuth,
  requireAdmin,
  requirePermission("manageProducts"),
  async (req, res) => {
    const reviewId = Number(paramString(req.params, "id"));
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      res.status(400).json({ error: "Invalid review ID" });
      return;
    }
    const result = await db
      .update(reviews)
      .set({ isApproved: true, updatedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.json({ success: true });
  },
);

router.delete(
  "/admin/dashboard/reviews/:id",
  requireAuth,
  requireAdmin,
  requirePermission("manageProducts"),
  async (req, res) => {
    const reviewId = Number(paramString(req.params, "id"));
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      res.status(400).json({ error: "Invalid review ID" });
      return;
    }
    const result = await db.delete(reviews).where(eq(reviews.id, reviewId));
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    res.json({ success: true });
  },
);

export default router;
