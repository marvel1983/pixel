import { Router } from "express";
import { db } from "@workspace/db";
import { attributeDefinitions, attributeOptions, productAttributes } from "@workspace/db/schema";
import { eq, asc, and, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { paramString } from "../lib/route-params";

const router = Router();

// ── Attribute Definitions ────────────────────────────────────────────────────

// GET /admin/attributes — list all with option count
router.get("/admin/attributes", requireAuth, requireAdmin, async (_req, res) => {
  const defs = await db
    .select({
      id: attributeDefinitions.id,
      name: attributeDefinitions.name,
      slug: attributeDefinitions.slug,
      type: attributeDefinitions.type,
      isFilterable: attributeDefinitions.isFilterable,
      isVisibleOnPdp: attributeDefinitions.isVisibleOnPdp,
      isSearchable: attributeDefinitions.isSearchable,
      unit: attributeDefinitions.unit,
      sortOrder: attributeDefinitions.sortOrder,
      createdAt: attributeDefinitions.createdAt,
    })
    .from(attributeDefinitions)
    .orderBy(asc(attributeDefinitions.sortOrder), asc(attributeDefinitions.id));

  // Get option counts
  const optCounts = await db
    .select({
      attributeId: attributeOptions.attributeId,
      cnt: count(),
    })
    .from(attributeOptions)
    .groupBy(attributeOptions.attributeId);

  const countMap = new Map(optCounts.map((r) => [r.attributeId, Number(r.cnt)]));

  res.json({
    attributes: defs.map((d) => ({ ...d, optionCount: countMap.get(d.id) ?? 0 })),
  });
});

// POST /admin/attributes — create definition
router.post("/admin/attributes", requireAuth, requireAdmin, async (req, res) => {
  const { name, slug, type, isFilterable, isVisibleOnPdp, isSearchable, unit, sortOrder } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const finalSlug = (slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  const [existing] = await db.select({ id: attributeDefinitions.id }).from(attributeDefinitions).where(eq(attributeDefinitions.slug, finalSlug));
  if (existing) { res.status(409).json({ error: "Slug already exists" }); return; }
  const [created] = await db.insert(attributeDefinitions).values({
    name: name.trim(),
    slug: finalSlug,
    type: type || "SELECT",
    isFilterable: isFilterable ?? true,
    isVisibleOnPdp: isVisibleOnPdp ?? true,
    isSearchable: isSearchable ?? false,
    unit: unit || null,
    sortOrder: sortOrder ?? 0,
  }).returning({ id: attributeDefinitions.id });
  res.status(201).json({ id: created.id });
});

// PUT /admin/attributes/:id — update definition
router.put("/admin/attributes/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, isFilterable, isVisibleOnPdp, isSearchable, unit, sortOrder } = req.body;
  await db.update(attributeDefinitions).set({
    ...(name !== undefined && { name }),
    ...(isFilterable !== undefined && { isFilterable }),
    ...(isVisibleOnPdp !== undefined && { isVisibleOnPdp }),
    ...(isSearchable !== undefined && { isSearchable }),
    ...(unit !== undefined && { unit: unit || null }),
    ...(sortOrder !== undefined && { sortOrder }),
    updatedAt: new Date(),
  }).where(eq(attributeDefinitions.id, id));
  res.json({ success: true });
});

// DELETE /admin/attributes/:id — delete definition (cascades to options + product_attributes)
router.delete("/admin/attributes/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(attributeDefinitions).where(eq(attributeDefinitions.id, id));
  res.json({ success: true });
});

// ── Attribute Options ─────────────────────────────────────────────────────────

// GET /admin/attributes/:id/options
router.get("/admin/attributes/:id/options", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const options = await db
    .select()
    .from(attributeOptions)
    .where(eq(attributeOptions.attributeId, id))
    .orderBy(asc(attributeOptions.sortOrder), asc(attributeOptions.id));
  res.json({ options });
});

// POST /admin/attributes/:id/options
router.post("/admin/attributes/:id/options", requireAuth, requireAdmin, async (req, res) => {
  const attrId = Number(paramString(req.params, "id"));
  if (!Number.isInteger(attrId) || attrId <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { value, slug, colorHex, sortOrder } = req.body;
  if (!value?.trim()) { res.status(400).json({ error: "value is required" }); return; }
  const finalSlug = slug?.trim() || value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [created] = await db.insert(attributeOptions).values({
    attributeId: attrId,
    value: value.trim(),
    slug: finalSlug,
    colorHex: colorHex || null,
    sortOrder: sortOrder ?? 0,
  }).returning({ id: attributeOptions.id });
  res.status(201).json({ id: created.id });
});

// PUT /admin/attribute-options/:id
router.put("/admin/attribute-options/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { value, colorHex, sortOrder } = req.body;
  await db.update(attributeOptions).set({
    ...(value !== undefined && { value }),
    ...(colorHex !== undefined && { colorHex: colorHex || null }),
    ...(sortOrder !== undefined && { sortOrder }),
  }).where(eq(attributeOptions.id, id));
  res.json({ success: true });
});

// DELETE /admin/attribute-options/:id
router.delete("/admin/attribute-options/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(attributeOptions).where(eq(attributeOptions.id, id));
  res.json({ success: true });
});

// ── Product ↔ Attribute Values ────────────────────────────────────────────────

// GET /admin/products/:id/attributes
router.get("/admin/products/:id/attributes", requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(paramString(req.params, "id"));
  if (!Number.isInteger(productId) || productId <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const values = await db
    .select({
      attributeId: productAttributes.attributeId,
      attributeName: attributeDefinitions.name,
      attributeSlug: attributeDefinitions.slug,
      attributeType: attributeDefinitions.type,
      unit: attributeDefinitions.unit,
      isVisibleOnPdp: attributeDefinitions.isVisibleOnPdp,
      optionId: productAttributes.optionId,
      optionValue: attributeOptions.value,
      valueText: productAttributes.valueText,
      valueNumber: productAttributes.valueNumber,
    })
    .from(productAttributes)
    .innerJoin(attributeDefinitions, eq(productAttributes.attributeId, attributeDefinitions.id))
    .leftJoin(attributeOptions, eq(productAttributes.optionId, attributeOptions.id))
    .where(eq(productAttributes.productId, productId))
    .orderBy(asc(attributeDefinitions.sortOrder));
  res.json({ attributes: values });
});

// PUT /admin/products/:id/attributes — bulk upsert (delete + insert in transaction)
router.put("/admin/products/:id/attributes", requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(paramString(req.params, "id"));
  if (!Number.isInteger(productId) || productId <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { attributes } = req.body as {
    attributes: Array<{ attributeId: number; optionId?: number | null; valueText?: string | null; valueNumber?: string | null }>;
  };
  if (!Array.isArray(attributes)) { res.status(400).json({ error: "attributes must be an array" }); return; }

  await db.transaction(async (tx) => {
    await tx.delete(productAttributes).where(eq(productAttributes.productId, productId));
    if (attributes.length > 0) {
      await tx.insert(productAttributes).values(
        attributes.map((a) => ({
          productId,
          attributeId: a.attributeId,
          optionId: a.optionId ?? null,
          valueText: a.valueText ?? null,
          valueNumber: a.valueNumber ?? null,
        }))
      );
    }
  });

  res.json({ success: true, upserted: attributes.length });
});

export default router;
