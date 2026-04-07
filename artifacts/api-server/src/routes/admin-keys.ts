import { Router } from "express";
import { db } from "@workspace/db";
import { licenseKeys, productVariants, products, orderItems, orders, auditLog } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, gte, lte, count, sql, isNull } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { decrypt } from "../lib/encryption";

const router = Router();

function makeMask(plaintext: string): string {
  if (plaintext.length <= 8) return plaintext.slice(0, 2) + "****";
  return plaintext.slice(0, 4) + "****" + plaintext.slice(-4);
}

function safeDecrypt(value: string): string {
  try { return decrypt(value); } catch { return value; }
}

async function ensureKeyMask(id: number, keyValue: string, currentMask: string | null): Promise<string> {
  if (currentMask) return currentMask;
  const plain = safeDecrypt(keyValue);
  const mask = makeMask(plain);
  await db.update(licenseKeys).set({ keyMask: mask }).where(eq(licenseKeys.id, id));
  return mask;
}

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
    .select({ status: licenseKeys.status, cnt: count() })
    .from(licenseKeys)
    .groupBy(licenseKeys.status);

  const statsMap: Record<string, number> = {};
  for (const s of stats) statsMap[s.status] = s.cnt;

  const [{ claimed }] = await db
    .select({ claimed: count() })
    .from(licenseKeys)
    .where(sql`${licenseKeys.revokeReason} LIKE 'CLAIM:%'`);

  const rows = await db
    .select({
      id: licenseKeys.id,
      keyValue: licenseKeys.keyValue,
      keyMask: licenseKeys.keyMask,
      status: licenseKeys.status,
      source: licenseKeys.source,
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

  const keys = await Promise.all(rows.map(async (r) => ({
    id: r.id,
    maskedKey: await ensureKeyMask(r.id, r.keyValue, r.keyMask),
    status: r.status,
    source: r.source,
    productName: r.productName,
    variantName: r.variantName,
    sku: r.sku,
    orderNumber: r.orderNumber,
    customerEmail: r.customerEmail,
    soldAt: r.soldAt,
    createdAt: r.createdAt,
  })));

  res.json({
    keys, total, page, limit,
    stats: {
      total: Object.values(statsMap).reduce((a, b) => a + b, 0),
      delivered: statsMap["SOLD"] ?? 0,
      pending: (statsMap["AVAILABLE"] ?? 0) + (statsMap["RESERVED"] ?? 0),
      claimed: claimed,
    },
  });
});

router.post("/admin/keys/backfill-masks", requireAuth, requireAdmin, async (_req, res) => {
  const nullMasks = await db.select({ id: licenseKeys.id, keyValue: licenseKeys.keyValue })
    .from(licenseKeys).where(isNull(licenseKeys.keyMask)).limit(500);
  let updated = 0;
  for (const row of nullMasks) {
    const plain = safeDecrypt(row.keyValue);
    const mask = makeMask(plain);
    await db.update(licenseKeys).set({ keyMask: mask }).where(eq(licenseKeys.id, row.id));
    updated++;
  }
  res.json({ updated, remaining: nullMasks.length === 500 });
});

router.get("/admin/keys/products", requireAuth, requireAdmin, async (_req, res) => {
  const prods = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .orderBy(products.name);
  res.json({ products: prods });
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

  const [key] = await db.select({ id: licenseKeys.id }).from(licenseKeys).where(eq(licenseKeys.id, id));
  if (!key) {
    res.status(404).json({ error: "Key not found" });
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
  if (key.status !== "SOLD") {
    res.status(400).json({ error: "Only sold keys can have claims submitted" });
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
      ilike(licenseKeys.keyMask, `%${search}%`),
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

export default router;
