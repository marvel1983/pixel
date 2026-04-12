import { Router } from "express";
import { db } from "@workspace/db";
import { licenseKeys, productVariants, products, orderItems, orders, auditLog } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, gte, lte, count, sql, isNull } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { decrypt, encrypt } from "../lib/encryption";
import { paramString } from "../lib/route-params";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

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

router.get("/admin/keys", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
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

router.post("/admin/keys/backfill-masks", requireAuth, requireAdmin, requirePermission("manageOrders"), async (_req, res) => {
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

router.get("/admin/keys/products", requireAuth, requireAdmin, requirePermission("manageOrders"), async (_req, res) => {
  const prods = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .orderBy(products.name);
  res.json({ products: prods });
});

router.post("/admin/keys/:id/reveal", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
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

router.post("/admin/keys/:id/copy-audit", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
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

router.patch("/admin/keys/:id/status", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
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

// ── GET /admin/keys/variants — list all variants for the import selector ──
router.get("/admin/keys/variants", requireAuth, requireAdmin, requirePermission("manageOrders"), async (_req, res) => {
  try {
    const rows = await db
      .select({ id: productVariants.id, sku: productVariants.sku, name: productVariants.name, productName: products.name })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .orderBy(products.name, productVariants.name);
    res.json({ variants: rows });
  } catch (err) {
    logger.error({ err }, "GET admin/keys/variants failed");
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

// ── POST /admin/keys — add single key ──
const addKeySchema = z.object({
  variantId: z.number().int().positive(),
  keyValue: z.string().min(1).max(500).transform((v) => v.trim()),
});

router.post("/admin/keys", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  try {
    const parsed = addKeySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "variantId and keyValue are required" }); return; }
    const { variantId, keyValue } = parsed.data;

    const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (!variant) { res.status(400).json({ error: "Variant not found" }); return; }

    const encrypted = encrypt(keyValue);
    const mask = makeMask(keyValue);
    const [inserted] = await db.insert(licenseKeys).values({
      variantId, keyValue: encrypted, keyMask: mask, status: "AVAILABLE", source: "MANUAL",
    }).returning({ id: licenseKeys.id });

    await db.insert(auditLog).values({
      userId: req.user!.userId, action: "CREATE", entityType: "license_key",
      entityId: inserted.id, details: { variantId, mask }, ipAddress: req.ip ?? null,
    });

    res.status(201).json({ success: true, id: inserted.id, mask });
  } catch (err) {
    logger.error({ err }, "POST admin/keys failed");
    res.status(500).json({ error: "Failed to add key" });
  }
});

// ── POST /admin/keys/bulk-import — add many keys at once ──
const bulkImportSchema = z.object({
  variantId: z.number().int().positive(),
  keys: z.string().min(1), // newline-separated
});

router.post("/admin/keys/bulk-import", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  try {
    const parsed = bulkImportSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "variantId and keys are required" }); return; }
    const { variantId, keys } = parsed.data;

    const [variant] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
    if (!variant) { res.status(400).json({ error: "Variant not found" }); return; }

    const lines = keys.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) { res.status(400).json({ error: "No valid keys found" }); return; }
    if (lines.length > 1000) { res.status(400).json({ error: "Maximum 1000 keys per import" }); return; }

    const values = lines.map((k) => ({
      variantId, keyValue: encrypt(k), keyMask: makeMask(k), status: "AVAILABLE" as const, source: "BULK_IMPORT" as const,
    }));

    await db.insert(licenseKeys).values(values);

    await db.insert(auditLog).values({
      userId: req.user!.userId, action: "IMPORT", entityType: "license_key",
      entityId: variantId, details: { variantId, count: lines.length }, ipAddress: req.ip ?? null,
    });

    res.status(201).json({ success: true, imported: lines.length });
  } catch (err) {
    logger.error({ err }, "POST admin/keys/bulk-import failed");
    res.status(500).json({ error: "Failed to import keys" });
  }
});

// ── DELETE /admin/keys/:id ──
router.delete("/admin/keys/:id", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  try {
    const id = Number(paramString(req.params, "id"));
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid key ID" }); return; }

    const [key] = await db.select({ id: licenseKeys.id, status: licenseKeys.status }).from(licenseKeys).where(eq(licenseKeys.id, id));
    if (!key) { res.status(404).json({ error: "Key not found" }); return; }
    if (key.status === "SOLD") { res.status(400).json({ error: "Cannot delete a sold key" }); return; }

    await db.delete(licenseKeys).where(eq(licenseKeys.id, id));
    await db.insert(auditLog).values({
      userId: req.user!.userId, action: "DELETE", entityType: "license_key",
      entityId: id, details: { action: "deleted" }, ipAddress: req.ip ?? null,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE admin/keys/:id failed");
    res.status(500).json({ error: "Failed to delete key" });
  }
});

// ── GET /admin/keys/export — CSV export ──
router.get("/admin/keys/export", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  try {
    const conditions = buildFilters(req.query);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: licenseKeys.id,
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
      .limit(10000);

    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = "ID,Key (masked),Product,SKU,Status,Source,Order #,Customer,Sold At,Created At";
    const csvLines = rows.map((r) => [
      r.id, esc(r.keyMask), esc(r.productName), esc(r.sku), r.status, r.source,
      esc(r.orderNumber ?? ""), esc(r.customerEmail ?? ""),
      r.soldAt ? new Date(r.soldAt).toISOString() : "",
      new Date(r.createdAt).toISOString(),
    ].join(","));

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="license-keys-${Date.now()}.csv"`);
    res.send([header, ...csvLines].join("\n"));
  } catch (err) {
    logger.error({ err }, "GET admin/keys/export failed");
    res.status(500).json({ error: "Failed to export keys" });
  }
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
