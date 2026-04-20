import { Router } from "express";
import { db } from "@workspace/db";
import { users, orders, wishlists, reviews, products } from "@workspace/db/schema";
import { eq, desc, sql, and, or, ilike, gte, lte, count, sum, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, evictUserStatusCache } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { paramString } from "../lib/route-params";

const router = Router();

router.get("/admin/customers", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;
  const conditions = buildFilters(req.query);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(users).where(where);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [{ newThisMonth }] = await db.select({ newThisMonth: count() }).from(users)
    .where(gte(users.createdAt, startOfMonth));

  const [{ withOrders }] = await db.select({ withOrders: sql<number>`COUNT(DISTINCT ${orders.userId})` }).from(orders)
    .where(sql`${orders.userId} IS NOT NULL`);

  const rows = await db.select({
    id: users.id, email: users.email, username: users.username,
    firstName: users.firstName, lastName: users.lastName,
    role: users.role, isActive: users.isActive, emailVerified: users.emailVerified,
    marketingConsent: users.marketingConsent,
    lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users).where(where).orderBy(desc(users.createdAt)).limit(limit).offset(offset);

  const userIds = rows.map((r) => r.id);
  let orderStats: Record<number, { orderCount: number; totalSpent: string; lastOrder: string | null }> = {};
  if (userIds.length > 0) {
    const stats = await db.select({
      userId: orders.userId,
      orderCount: count(),
      totalSpent: sum(orders.totalUsd),
      lastOrder: sql<string>`MAX(${orders.createdAt})`,
    }).from(orders).where(inArray(orders.userId, userIds)).groupBy(orders.userId);
    for (const s of stats) {
      if (s.userId) orderStats[s.userId] = {
        orderCount: Number(s.orderCount), totalSpent: s.totalSpent ?? "0",
        lastOrder: s.lastOrder,
      };
    }
  }

  const result = rows.map((r) => ({
    ...r,
    orderCount: orderStats[r.id]?.orderCount ?? 0,
    totalSpent: orderStats[r.id]?.totalSpent ?? "0",
    lastOrder: orderStats[r.id]?.lastOrder ?? null,
  }));

  res.json({
    customers: result, total, page, limit,
    stats: { totalCustomers: total, newThisMonth, withOrders: Number(withOrders) },
  });
});

router.get("/admin/customers/:id", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [customer] = await db.select({
    id: users.id, email: users.email, username: users.username,
    firstName: users.firstName, lastName: users.lastName,
    role: users.role, isActive: users.isActive, emailVerified: users.emailVerified,
    marketingConsent: users.marketingConsent, adminNotes: users.adminNotes,
    lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users).where(eq(users.id, id));
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }

  const customerOrders = await db.select({
    id: orders.id, orderNumber: orders.orderNumber, status: orders.status,
    totalUsd: orders.totalUsd, createdAt: orders.createdAt,
  }).from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).limit(50);

  const [{ totalSpent }] = await db.select({ totalSpent: sum(orders.totalUsd) }).from(orders).where(eq(orders.userId, id));
  const [{ orderCount }] = await db.select({ orderCount: count() }).from(orders).where(eq(orders.userId, id));

  const wishlistItems = await db.select({
    id: wishlists.id, productId: wishlists.productId,
    productName: products.name, createdAt: wishlists.createdAt,
  }).from(wishlists)
    .innerJoin(products, eq(wishlists.productId, products.id))
    .where(eq(wishlists.userId, id))
    .orderBy(desc(wishlists.createdAt)).limit(20);

  const customerReviews = await db.select({
    id: reviews.id, productId: reviews.productId, rating: reviews.rating,
    title: reviews.title, body: reviews.body, isApproved: reviews.isApproved,
    isVerifiedPurchase: reviews.isVerifiedPurchase, helpfulCount: reviews.helpfulCount,
    createdAt: reviews.createdAt, productName: products.name,
  }).from(reviews)
    .innerJoin(products, eq(reviews.productId, products.id))
    .where(eq(reviews.userId, id))
    .orderBy(desc(reviews.createdAt)).limit(20);

  const [{ avgRating }] = await db.select({ avgRating: sql<string>`COALESCE(AVG(${reviews.rating}), 0)` })
    .from(reviews).where(eq(reviews.userId, id));

  res.json({
    customer, orders: customerOrders, wishlist: wishlistItems, reviews: customerReviews,
    stats: { totalSpent: totalSpent ?? "0", orderCount: Number(orderCount), avgRating: parseFloat(avgRating) },
  });
});

router.patch("/admin/customers/:id/role", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { role } = req.body;
  if (!["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
  const caller = req.user as unknown as { id: number; role: string };
  if (role === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admins can assign the Super Admin role" }); return;
  }
  if (role === "ADMIN" && caller.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admins can assign the Admin role" }); return;
  }
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  if (target.role === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admins can modify a Super Admin's role" }); return;
  }
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id));
  res.json({ success: true });
});

router.patch("/admin/customers/:id/notes", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(users).set({ adminNotes: req.body.notes ?? null, updatedAt: new Date() }).where(eq(users.id, id));
  res.json({ success: true });
});

router.post("/admin/customers/:id/reset-password", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  const caller = req.user as { role: string };
  if (target.role === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admins can reset a Super Admin password" }); return;
  }
  const tempPassword = crypto.randomBytes(6).toString("base64url") + "A1!";
  const hash = await bcrypt.hash(tempPassword, 12);
  await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, id));
  res.json({ success: true, tempPassword });
});

router.patch("/admin/customers/:id/toggle-active", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [user] = await db.select({ isActive: users.isActive, role: users.role }).from(users).where(eq(users.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  const caller = req.user as { role: string };
  if (user.role === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admins can deactivate a Super Admin" }); return;
  }
  await db.update(users).set({ isActive: !user.isActive, updatedAt: new Date() }).where(eq(users.id, id));
  evictUserStatusCache(id);
  res.json({ isActive: !user.isActive });
});

router.delete("/admin/customers/:id", requireAuth, requireAdmin, requirePermission("manageCustomers"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, id));
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  const caller = req.user as unknown as { id: number; role: string };
  if (target.role === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Only Super Admins can delete a Super Admin" }); return;
  }
  try {
    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch {
    await db.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, id));
    evictUserStatusCache(id);
    res.json({ success: true, deactivated: true, message: "Account deactivated (has existing data)" });
  }
});

function buildFilters(query: Record<string, unknown>) {
  const conditions = [];
  const search = query.search as string | undefined;
  if (search?.trim()) {
    conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.firstName, `%${search}%`), ilike(users.lastName, `%${search}%`)));
  }
  const role = query.role as string | undefined;
  if (role && role !== "ALL") conditions.push(eq(users.role, role as "CUSTOMER" | "ADMIN" | "SUPER_ADMIN"));
  const from = query.from as string | undefined;
  if (from) conditions.push(gte(users.createdAt, new Date(from)));
  const to = query.to as string | undefined;
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); conditions.push(lte(users.createdAt, d)); }
  const hasOrders = query.hasOrders as string | undefined;
  if (hasOrders === "true") conditions.push(sql`${users.id} IN (SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL)`);
  return conditions;
}

export default router;
