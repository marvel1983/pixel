import { Router } from "express";
import { db } from "@workspace/db";
import { licenseKeys, productVariants, products, orderItems, orders, auditLog } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, gte, lte, inArray, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { decrypt } from "../lib/encryption";

const router = Router();

router.get("/admin/keys", requireAuth, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const conditions = buildFilters(req.query);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(licenseKeys)
    .innerJoin(productVariants, eq(licenseKeys.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(orderItems, eq(licenseKeys.orderItemId, orderItems.id))
    .leftJoin(orders, eq(orderItems.orderId, orders.id))
    .where(whereClause);

  const stats = await db
    .select({
      status: licenseKeys.status,
      cnt: count(),
    })
    .from(licenseKeys)
    .groupBy(licenseKeys.status);

  const statsMap: Record<string, number> = {};
  for (const s of stats) statsMap[s.status] = s.cnt;

  const rows = await db
    .select({
      id: licenseKeys.id,
      maskedKey: sql<string>`CONCAT(LEFT(${licenseKeys.keyValue}, 4), '****', RIGHT(${licenseKeys.keyValue}, 4))`,
      status: licenseKeys.status,
      source: licenseKeys.source,
      variantId: licenseKeys.variantId,
      productName: products.name,
      variantName: productVariants.name,
      sku: productVariants.sku,
      orderNumber: orders.orderNumber,
      customerEmail: orders.guestEmail,
      soldAt: licenseKeys.soldAt,
      createdAt: licenseKeys.createdAt,
    })
    .from(licenseKeys)
    .innerJoin(productVariants, eq(licenseKeys.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(orderItems, eq(licenseKeys.orderItemId, orderItems.id))
    .leftJoin(orders, eq(orderItems.orderId, orders.id))
    .where(whereClause)
    .orderBy(desc(licenseKeys.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    keys: rows, total, page, limit,
    stats: {
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
      delivered: statsMap["SOLD"] ?? 0,
      available: statsMap["AVAILABLE"] ?? 0,
      revoked: statsMap["REVOKED"] ?? 0,
    },
  });
});

router.post("/admin/keys/:id/reveal", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key ID" });
    return;
  }

  const [key] = await db.select({ keyValue: licenseKeys.keyValue }).from(licenseKeys).where(eq(licenseKeys.id, id));
  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  await db.insert(auditLog).values({
    userId: req.user!.userId,
    action: "KEY_REVEAL",
    entityType: "license_key",
    entityId: id,
    details: { action: "reveal" },
    ipAddress: req.ip ?? null,
  });

  res.json({ keyValue: safeDecrypt(key.keyValue) });
});

router.post("/admin/keys/:id/copy-audit", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key ID" });
    return;
  }

  await db.insert(auditLog).values({
    userId: req.user!.userId,
    action: "KEY_COPY",
    entityType: "license_key",
    entityId: id,
    details: { action: "copy_to_clipboard" },
    ipAddress: req.ip ?? null,
  });

  res.json({ success: true });
});

router.post("/admin/keys/:id/claim", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key ID" });
    return;
  }

  const { reason, customerEmail } = req.body;
  if (!reason?.trim()) {
    res.status(400).json({ error: "Claim reason is required" });
    return;
  }

  const [key] = await db.select({ id: licenseKeys.id, status: licenseKeys.status }).from(licenseKeys).where(eq(licenseKeys.id, id));
  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  await db.update(licenseKeys).set({
    status: "REVOKED",
    revokedAt: new Date(),
    revokeReason: `CLAIM: ${reason} (${customerEmail ?? "N/A"})`,
  }).where(eq(licenseKeys.id, id));

  await db.insert(auditLog).values({
    userId: req.user!.userId,
    action: "KEY_REVOKE",
    entityType: "license_key",
    entityId: id,
    details: { action: "claim", reason, customerEmail, previousStatus: key.status },
    ipAddress: req.ip ?? null,
  });

  res.json({ success: true });
});

router.patch("/admin/keys/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key ID" });
    return;
  }

  const validStatuses = ["AVAILABLE", "SOLD", "RESERVED", "REVOKED"];
  const { status } = req.body;
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [key] = await db.select({ id: licenseKeys.id }).from(licenseKeys).where(eq(licenseKeys.id, id));
  if (!key) {
    res.status(404).json({ error: "Key not found" });
    return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === "REVOKED") updates.revokedAt = new Date();

  await db.update(licenseKeys).set(updates).where(eq(licenseKeys.id, id));
  res.json({ success: true });
});

function buildFilters(query: Record<string, unknown>) {
  const conditions = [];
  const search = query.search as string | undefined;
  if (search?.trim()) {
    conditions.push(or(
      ilike(licenseKeys.keyValue, `%${search}%`),
      ilike(orders.orderNumber, `%${search}%`),
      ilike(products.name, `%${search}%`),
      ilike(productVariants.sku, `%${search}%`),
    ));
  }
  const status = query.status as string | undefined;
  if (status && status !== "ALL") conditions.push(eq(licenseKeys.status, status as typeof licenseKeys.$inferSelect.status));
  const productId = query.productId as string | undefined;
  if (productId) conditions.push(eq(products.id, Number(productId)));
  const from = query.from as string | undefined;
  if (from) conditions.push(gte(licenseKeys.createdAt, new Date(from)));
  const to = query.to as string | undefined;
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(licenseKeys.createdAt, endOfDay));
  }
  return conditions;
}

function safeDecrypt(value: string): string {
  try { return decrypt(value); } catch { return value; }
}

export default router;
