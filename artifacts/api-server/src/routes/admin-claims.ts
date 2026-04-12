import { Router } from "express";
import { db } from "@workspace/db";
import { claims, licenseKeys, orders, products, productVariants, orderItems } from "@workspace/db/schema";
import { eq, desc, and, or, gte, lte, count, sql, avg, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { metenziRequest } from "../lib/metenzi-client";
import { logger } from "../lib/logger";
import { paramString } from "../lib/route-params";

const router = Router();

router.get("/admin/claims", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const conditions = buildFilters(req.query);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(claims).where(whereClause);

  const statsRows = await db
    .select({ status: claims.status, cnt: count() })
    .from(claims)
    .groupBy(claims.status);

  const statsMap: Record<string, number> = {};
  for (const s of statsRows) statsMap[s.status] = s.cnt;

  const [avgRow] = await db
    .select({
      avgMs: avg(sql`EXTRACT(EPOCH FROM (${claims.resolvedAt} - ${claims.createdAt})) * 1000`),
    })
    .from(claims)
    .where(isNotNull(claims.resolvedAt));

  const avgResolutionMs = avgRow?.avgMs ? Number(avgRow.avgMs) : null;

  const rows = await db
    .select({
      id: claims.id,
      metenziClaimId: claims.metenziClaimId,
      customerEmail: claims.customerEmail,
      reason: claims.reason,
      status: claims.status,
      notes: claims.notes,
      adminNotes: claims.adminNotes,
      resolvedAt: claims.resolvedAt,
      createdAt: claims.createdAt,
      updatedAt: claims.updatedAt,
      keyMask: licenseKeys.keyMask,
      orderNumber: orders.orderNumber,
    })
    .from(claims)
    .leftJoin(licenseKeys, eq(claims.licenseKeyId, licenseKeys.id))
    .leftJoin(orders, eq(claims.orderId, orders.id))
    .where(whereClause)
    .orderBy(desc(claims.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    claims: rows, total, page, limit,
    stats: {
      open: (statsMap["OPEN"] ?? 0) + (statsMap["IN_REVIEW"] ?? 0),
      resolved: (statsMap["APPROVED"] ?? 0) + (statsMap["RESOLVED"] ?? 0) + (statsMap["DENIED"] ?? 0),
      avgResolutionMs,
    },
  });
});

router.get("/admin/claims/orders", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const search = (req.query.search as string)?.trim();
  const conds = search ? or(
    sql`${orders.orderNumber} ILIKE ${"%" + search + "%"}`,
    sql`${orders.guestEmail} ILIKE ${"%" + search + "%"}`,
  ) : undefined;

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      email: orders.guestEmail,
    })
    .from(orders)
    .where(conds)
    .orderBy(desc(orders.createdAt))
    .limit(20);

  res.json({ orders: rows });
});

router.get("/admin/claims/keys-for-order/:orderId", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const orderId = Number(paramString(req.params, "orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    res.status(400).json({ error: "Invalid order ID" });
    return;
  }

  const rows = await db
    .select({
      id: licenseKeys.id,
      keyMask: licenseKeys.keyMask,
      status: licenseKeys.status,
      productName: products.name,
      sku: productVariants.sku,
    })
    .from(licenseKeys)
    .innerJoin(orderItems, eq(licenseKeys.orderItemId, orderItems.id))
    .innerJoin(productVariants, eq(licenseKeys.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(orderItems.orderId, orderId));

  res.json({ keys: rows });
});

router.post("/admin/claims", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { orderId, licenseKeyId, customerEmail, reason, notes } = req.body;
  const validReasons = ["DEFECTIVE", "ALREADY_USED", "WRONG_PRODUCT", "NOT_RECEIVED", "OTHER"];
  if (!customerEmail?.trim() || !reason) {
    res.status(400).json({ error: "Customer email and reason are required" });
    return;
  }
  if (!validReasons.includes(reason)) {
    res.status(400).json({ error: "Invalid claim reason" });
    return;
  }

  let resolvedOrderId = orderId ? Number(orderId) : null;
  if (!resolvedOrderId && licenseKeyId) {
    const [keyRow] = await db
      .select({ orderItemId: licenseKeys.orderItemId })
      .from(licenseKeys)
      .where(eq(licenseKeys.id, Number(licenseKeyId)));
    if (keyRow?.orderItemId) {
      const [itemRow] = await db
        .select({ orderId: orderItems.orderId })
        .from(orderItems)
        .where(eq(orderItems.id, keyRow.orderItemId));
      if (itemRow) resolvedOrderId = itemRow.orderId;
    }
  }

  let metenziClaimId: string | null = null;
  try {
    const config = await getMetenziConfig();
    if (config) {
      const metenziRes = await metenziRequest<{ id?: string; claimId?: string }>(config, {
        method: "POST",
        path: "/api/v1/claims",
        body: { licenseKeyId, customerEmail, reason, notes },
      });
      if (metenziRes.ok) {
        metenziClaimId = metenziRes.data.claimId ?? metenziRes.data.id ?? null;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Failed to submit claim to Metenzi");
  }

  const [claim] = await db.insert(claims).values({
    orderId: resolvedOrderId,
    licenseKeyId: licenseKeyId ? Number(licenseKeyId) : null,
    customerEmail: customerEmail.trim(),
    reason,
    notes: notes?.trim() || null,
    metenziClaimId,
  }).returning();

  if (licenseKeyId) {
    const [lk] = await db.select({ status: licenseKeys.status }).from(licenseKeys).where(eq(licenseKeys.id, Number(licenseKeyId)));
    if (lk && lk.status !== "REVOKED") {
      await db.update(licenseKeys).set({
        status: "REVOKED",
        revokedAt: new Date(),
        revokeReason: `CLAIM: ${reason} (${customerEmail})`,
      }).where(eq(licenseKeys.id, Number(licenseKeyId)));
    }
  }

  res.json({ claim });
});

router.post("/admin/claims/:id/refresh", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid claim ID" });
    return;
  }

  const [claim] = await db.select().from(claims).where(eq(claims.id, id));
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }

  if (!claim.metenziClaimId) {
    res.status(400).json({ error: "No Metenzi claim ID linked" });
    return;
  }

  const config = await getMetenziConfig();
  if (!config) {
    res.status(503).json({ error: "Metenzi API not configured" });
    return;
  }

  try {
    const metenziRes = await metenziRequest<{ status?: string; notes?: string }>(config, {
      method: "GET",
      path: `/api/v1/claims/${claim.metenziClaimId}`,
    });

    if (!metenziRes.ok) {
      res.status(502).json({ error: "Failed to fetch from Metenzi" });
      return;
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const mStatus = metenziRes.data.status?.toUpperCase();
    const validStatuses = ["OPEN", "IN_REVIEW", "APPROVED", "DENIED", "RESOLVED"];
    if (mStatus && validStatuses.includes(mStatus)) {
      updates.status = mStatus;
      if (["APPROVED", "DENIED", "RESOLVED"].includes(mStatus) && !claim.resolvedAt) {
        updates.resolvedAt = new Date();
      }
    }
    if (metenziRes.data.notes) updates.adminNotes = metenziRes.data.notes;

    await db.update(claims).set(updates).where(eq(claims.id, id));
    const [updated] = await db.select().from(claims).where(eq(claims.id, id));
    res.json({ claim: updated });
  } catch (err) {
    logger.error({ err }, "Metenzi claim refresh failed");
    res.status(502).json({ error: "Metenzi API error" });
  }
});

router.patch("/admin/claims/:id", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid claim ID" });
    return;
  }

  const [claim] = await db.select({ id: claims.id }).from(claims).where(eq(claims.id, id));
  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }

  const { status, adminNotes } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const validStatuses = ["OPEN", "IN_REVIEW", "APPROVED", "DENIED", "RESOLVED"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid claim status" });
    return;
  }
  if (status) {
    updates.status = status;
    if (["APPROVED", "DENIED", "RESOLVED"].includes(status)) updates.resolvedAt = new Date();
  }
  if (adminNotes !== undefined) updates.adminNotes = adminNotes;

  await db.update(claims).set(updates).where(eq(claims.id, id));
  res.json({ success: true });
});

function buildFilters(query: Record<string, unknown>) {
  const conditions = [];
  const status = query.status as string | undefined;
  if (status && status !== "ALL") {
    conditions.push(eq(claims.status, status as typeof claims.$inferSelect.status));
  }
  const reason = query.reason as string | undefined;
  if (reason && reason !== "ALL") {
    conditions.push(eq(claims.reason, reason as typeof claims.$inferSelect.reason));
  }
  const from = query.from as string | undefined;
  if (from) conditions.push(gte(claims.createdAt, new Date(from)));
  const to = query.to as string | undefined;
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(claims.createdAt, endOfDay));
  }
  return conditions;
}

export default router;
