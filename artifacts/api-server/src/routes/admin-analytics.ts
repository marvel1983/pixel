import { Router } from "express";
import { db } from "@workspace/db";
import { orders, orderItems, products, productVariants, categories, users } from "@workspace/db/schema";
import { eq, sql, and, gte, lte, count, sum, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get(
  "/admin/analytics",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const startDate = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const endDate = to ? new Date(to) : new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const [summary] = await db
      .select({
        totalOrders: count(),
        totalRevenue: sum(orders.totalUsd),
      })
      .from(orders)
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)));

    const avgOrderValue =
      summary.totalOrders > 0
        ? Number(summary.totalRevenue ?? 0) / summary.totalOrders
        : 0;

    const [newCustomers] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          gte(users.createdAt, startDate),
          lte(users.createdAt, endDate),
          eq(users.role, "CUSTOMER"),
        ),
      );

    const [returningCustomers] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${orders.userId})`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.createdAt, startDate),
          lte(orders.createdAt, endDate),
          sql`${orders.userId} IN (
            SELECT user_id FROM orders
            WHERE created_at < ${startDate}
            AND user_id IS NOT NULL
          )`,
        ),
      );

    const dailyRevenue = await db
      .select({
        date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`,
        revenue: sum(orders.totalUsd),
      })
      .from(orders)
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
      .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`);

    const dailyOrders = await db
      .select({
        date: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`,
        status: orders.status,
        count: count(),
      })
      .from(orders)
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
      .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`, orders.status)
      .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`);

    const ordersByDate: Record<string, Record<string, number>> = {};
    for (const row of dailyOrders) {
      if (!ordersByDate[row.date]) ordersByDate[row.date] = {};
      ordersByDate[row.date][row.status] = row.count;
    }
    const ordersByStatus = Object.entries(ordersByDate).map(([date, statuses]) => ({
      date,
      ...statuses,
    }));

    const topProducts = await db
      .select({
        productName: orderItems.productName,
        unitsSold: sum(orderItems.quantity),
        revenue: sum(sql`${orderItems.priceUsd} * ${orderItems.quantity}`),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
      .groupBy(orderItems.productName)
      .orderBy(desc(sum(orderItems.quantity)))
      .limit(10);

    const categoryRevenue = await db
      .select({
        category: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
        revenue: sum(sql`${orderItems.priceUsd} * ${orderItems.quantity}`),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)))
      .groupBy(sql`COALESCE(${categories.name}, 'Uncategorized')`)
      .orderBy(desc(sum(sql`${orderItems.priceUsd} * ${orderItems.quantity}`)));

    res.json({
      summary: {
        totalOrders: summary.totalOrders,
        totalRevenue: Number(summary.totalRevenue ?? 0),
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        newCustomers: newCustomers?.count ?? 0,
        returningCustomers: Number(returningCustomers?.count ?? 0),
      },
      dailyRevenue: dailyRevenue.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue ?? 0),
      })),
      ordersByStatus,
      topProducts: topProducts.map((p) => ({
        productName: p.productName,
        unitsSold: Number(p.unitsSold ?? 0),
        revenue: Number(p.revenue ?? 0),
      })),
      categoryRevenue: categoryRevenue.map((c) => ({
        category: c.category,
        revenue: Number(c.revenue ?? 0),
      })),
    });
  },
);

export default router;
