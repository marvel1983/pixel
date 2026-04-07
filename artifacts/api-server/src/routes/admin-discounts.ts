import { Router } from "express";
import { db } from "@workspace/db";
import { coupons, orders } from "@workspace/db/schema";
import { eq, desc, and, ilike, count, sum, sql, gte, lte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import crypto from "node:crypto";

const router = Router();

router.get("/admin/discounts", requireAuth, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const conditions = buildFilters(req.query);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(coupons).where(whereClause);

  const rows = await db.select().from(coupons)
    .where(whereClause)
    .orderBy(desc(coupons.createdAt))
    .limit(limit).offset(offset);

  const [activeCount] = await db.select({ cnt: count() }).from(coupons).where(eq(coupons.isActive, true));
  const [totalDiscount] = await db
    .select({ total: sum(sql`CASE WHEN ${orders.couponId} IS NOT NULL THEN COALESCE(${orders.discountUsd}, 0) ELSE 0 END`) })
    .from(orders);

  res.json({
    discounts: rows, total, page, limit,
    stats: {
      totalCodes: total,
      activeCodes: activeCount.cnt,
      totalDiscountGiven: Number(totalDiscount.total ?? 0),
    },
  });
});

router.get("/admin/discounts/check-code", requireAuth, requireAdmin, async (req, res) => {
  const code = (req.query.code as string)?.trim().toUpperCase();
  if (!code) { res.json({ available: false }); return; }
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : null;
  const conds = excludeId
    ? and(eq(coupons.code, code), sql`${coupons.id} != ${excludeId}`)
    : eq(coupons.code, code);
  const [existing] = await db.select({ id: coupons.id }).from(coupons).where(conds);
  res.json({ available: !existing });
});

router.get("/admin/discounts/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [disc] = await db.select().from(coupons).where(eq(coupons.id, id));
  if (!disc) { res.status(404).json({ error: "Discount not found" }); return; }
  res.json({ discount: disc });
});

router.post("/admin/discounts", requireAuth, requireAdmin, async (req, res) => {
  const data = parseDiscountBody(req.body);
  if (!data) { res.status(400).json({ error: "Invalid discount data" }); return; }

  const [existing] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, data.code));
  if (existing) { res.status(409).json({ error: "Code already exists" }); return; }

  const [disc] = await db.insert(coupons).values(data).returning();
  res.json({ discount: disc });
});

router.put("/admin/discounts/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.id, id));
  if (!existing) { res.status(404).json({ error: "Discount not found" }); return; }

  const data = parseDiscountBody(req.body);
  if (!data) { res.status(400).json({ error: "Invalid discount data" }); return; }
  delete (data as Record<string, unknown>).usedCount;

  const [dup] = await db.select({ id: coupons.id }).from(coupons)
    .where(and(eq(coupons.code, data.code), sql`${coupons.id} != ${id}`));
  if (dup) { res.status(409).json({ error: "Code already exists" }); return; }

  await db.update(coupons).set(data).where(eq(coupons.id, id));
  const [updated] = await db.select().from(coupons).where(eq(coupons.id, id));
  res.json({ discount: updated });
});

router.patch("/admin/discounts/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [disc] = await db.select({ isActive: coupons.isActive }).from(coupons).where(eq(coupons.id, id));
  if (!disc) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(coupons).set({ isActive: !disc.isActive }).where(eq(coupons.id, id));
  res.json({ isActive: !disc.isActive });
});

router.delete("/admin/discounts/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(coupons).where(eq(coupons.id, id));
  res.json({ success: true });
});

router.post("/admin/discounts/bulk", requireAuth, requireAdmin, async (req, res) => {
  const { prefix, length, quantity, discountType, discountValue, minOrderUsd, maxDiscountUsd, usageLimit, expiresAt } = req.body;
  const qty = Math.min(1000, Math.max(1, Number(quantity) || 10));
  const codeLen = Math.min(20, Math.max(4, Number(length) || 8));
  const pfx = (prefix || "").toUpperCase().slice(0, 10);

  if (!discountType || !discountValue) {
    res.status(400).json({ error: "Discount type and value required" });
    return;
  }

  const groupId = crypto.randomBytes(8).toString("hex");
  const codes: string[] = [];
  const existingCodes = new Set(
    (await db.select({ code: coupons.code }).from(coupons)).map((r) => r.code)
  );

  for (let i = 0; i < qty && codes.length < qty; i++) {
    const rand = crypto.randomBytes(codeLen).toString("hex").toUpperCase().slice(0, codeLen);
    const code = pfx ? `${pfx}-${rand}` : rand;
    if (!existingCodes.has(code)) {
      codes.push(code);
      existingCodes.add(code);
    }
  }

  if (codes.length > 0) {
    await db.insert(coupons).values(codes.map((code) => ({
      code,
      discountType,
      discountValue: String(discountValue),
      minOrderUsd: minOrderUsd ? String(minOrderUsd) : null,
      maxDiscountUsd: maxDiscountUsd ? String(maxDiscountUsd) : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      bulkGroupId: groupId,
    })));
  }

  res.json({ generated: codes.length, groupId, codes });
});

router.get("/admin/discounts/:id/usage", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [disc] = await db.select().from(coupons).where(eq(coupons.id, id));
  if (!disc) { res.status(404).json({ error: "Not found" }); return; }

  const usageOrders = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    email: orders.guestEmail,
    totalUsd: orders.totalUsd,
    discountUsd: orders.discountUsd,
    createdAt: orders.createdAt,
  }).from(orders)
    .where(eq(orders.couponId, id))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const dailyUsage = await db
    .select({
      day: sql<string>`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`,
      cnt: count(),
      total: sum(orders.discountUsd),
    })
    .from(orders)
    .where(eq(orders.couponId, id))
    .groupBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`TO_CHAR(${orders.createdAt}, 'YYYY-MM-DD')`);

  const [totals] = await db.select({
    totalOrders: count(),
    totalDiscounted: sum(orders.discountUsd),
    totalRevenue: sum(orders.totalUsd),
  }).from(orders).where(eq(orders.couponId, id));

  res.json({
    discount: disc,
    orders: usageOrders,
    dailyUsage,
    stats: {
      totalOrders: totals.totalOrders,
      totalDiscounted: Number(totals.totalDiscounted ?? 0),
      totalRevenue: Number(totals.totalRevenue ?? 0),
    },
  });
});

function buildFilters(query: Record<string, unknown>) {
  const conditions = [];
  const search = query.search as string | undefined;
  if (search?.trim()) conditions.push(ilike(coupons.code, `%${search}%`));
  const status = query.status as string | undefined;
  if (status === "active") conditions.push(eq(coupons.isActive, true));
  if (status === "inactive") conditions.push(eq(coupons.isActive, false));
  const type = query.type as string | undefined;
  if (type === "PERCENTAGE" || type === "FIXED") conditions.push(eq(coupons.discountType, type));
  return conditions;
}

function parseDiscountBody(body: Record<string, unknown>) {
  const code = (body.code as string)?.trim().toUpperCase();
  const discountType = body.discountType as string;
  const discountValue = body.discountValue;
  if (!code || !discountType || !discountValue) return null;
  if (discountType !== "PERCENTAGE" && discountType !== "FIXED") return null;

  return {
    code,
    description: (body.description as string)?.trim() || null,
    discountType: discountType as "PERCENTAGE" | "FIXED",
    discountValue: String(discountValue),
    minOrderUsd: body.minOrderUsd ? String(body.minOrderUsd) : null,
    maxDiscountUsd: body.maxDiscountUsd ? String(body.maxDiscountUsd) : null,
    usageLimit: body.usageLimit ? Number(body.usageLimit) : null,
    usedCount: body.usedCount !== undefined ? Number(body.usedCount) : 0,
    isActive: body.isActive !== false,
    singleUsePerCustomer: body.singleUsePerCustomer === true,
    excludeSaleItems: body.excludeSaleItems === true,
    productIds: Array.isArray(body.productIds) ? body.productIds : null,
    categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds : null,
    startsAt: body.startsAt ? new Date(body.startsAt as string) : null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt as string) : null,
  };
}

export default router;
