import { Router } from "express";
import { db } from "@workspace/db";
import { orders, orderItems, users } from "@workspace/db/schema";
import { eq, sql, and, gte, lte, count, sum, desc, ne } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { startOfLocalDay, endOfLocalDay } from "../lib/date-range";

const router = Router();

router.get(
  "/admin/analytics",
  requireAuth,
  requireAdmin,
  requirePermission("viewAnalytics"),
  async (req, res) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const startDate = from ? startOfLocalDay(from) : new Date(Date.now() - 30 * 86400000);
    const endDate = to ? endOfLocalDay(to) : new Date();

    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
      return;
    }

    if (!from) startDate.setHours(0, 0, 0, 0);
    if (!to) endDate.setHours(23, 59, 59, 999);

    const inRange = and(
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
      ne(orders.status, "FAILED"),
    );

    const [summary] = await db
      .select({
        totalOrders: count(),
        totalRevenue: sum(orders.totalUsd),
      })
      .from(orders)
      .where(inRange);

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
          inRange,
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
      .where(inRange)
      .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`);

    const products = await db
      .select({
        productName: orderItems.productName,
        unitsSold: sum(orderItems.quantity),
        revenue: sum(sql`${orderItems.priceUsd} * ${orderItems.quantity}`),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inRange)
      .groupBy(orderItems.productName)
      .orderBy(desc(sum(sql`${orderItems.priceUsd} * ${orderItems.quantity}`)));

    const topCustomers = await db
      .select({
        email: sql<string>`COALESCE(${users.email}, ${orders.guestEmail})`,
        name: sql<string | null>`NULLIF(TRIM(COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, '')), '')`,
        orderCount: count(),
        revenue: sum(orders.totalUsd),
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(
        and(
          inRange,
          sql`COALESCE(${users.email}, ${orders.guestEmail}) IS NOT NULL`,
        ),
      )
      .groupBy(
        sql`COALESCE(${users.email}, ${orders.guestEmail})`,
        users.firstName,
        users.lastName,
      )
      .orderBy(desc(sum(orders.totalUsd)))
      .limit(15);

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
      products: products.map((p) => {
        const units = Number(p.unitsSold ?? 0);
        const revenue = Number(p.revenue ?? 0);
        return {
          productName: p.productName,
          unitsSold: units,
          revenue,
          avgPrice: units > 0 ? Math.round((revenue / units) * 100) / 100 : 0,
        };
      }),
      topCustomers: topCustomers.map((c) => ({
        email: c.email,
        name: c.name,
        orderCount: c.orderCount,
        revenue: Number(c.revenue ?? 0),
      })),
    });
  },
);

export default router;
