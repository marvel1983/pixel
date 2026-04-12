import { Router } from "express";
import { db } from "@workspace/db";
import { tags, productTags, products } from "@workspace/db/schema";
import { eq, asc, count, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { paramString } from "../lib/route-params";

const router = Router();

// GET /admin/tags — list all with product count
router.get("/admin/tags", requireAuth, requireAdmin, async (_req, res) => {
  const allTags = await db
    .select()
    .from(tags)
    .orderBy(asc(tags.sortOrder), asc(tags.id));

  const counts = await db
    .select({ tagId: productTags.tagId, cnt: count() })
    .from(productTags)
    .groupBy(productTags.tagId);

  const countMap = new Map(counts.map((r) => [r.tagId, Number(r.cnt)]));
  res.json({ tags: allTags.map((t) => ({ ...t, productCount: countMap.get(t.id) ?? 0 })) });
});

// POST /admin/tags
router.post("/admin/tags", requireAuth, requireAdmin, async (req, res) => {
  const { name, slug, colorHex, sortOrder } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const finalSlug = slug?.trim() || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, finalSlug));
  if (existing) { res.status(409).json({ error: "Tag slug already exists" }); return; }
  const [created] = await db.insert(tags).values({
    name: name.trim(),
    slug: finalSlug,
    colorHex: colorHex || "#3b82f6",
    sortOrder: sortOrder ?? 0,
  }).returning({ id: tags.id });
  res.status(201).json({ id: created.id });
});

// PUT /admin/tags/:id
router.put("/admin/tags/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, colorHex, sortOrder } = req.body;
  await db.update(tags).set({
    ...(name !== undefined && { name }),
    ...(colorHex !== undefined && { colorHex }),
    ...(sortOrder !== undefined && { sortOrder }),
  }).where(eq(tags.id, id));
  res.json({ success: true });
});

// DELETE /admin/tags/:id
router.delete("/admin/tags/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(tags).where(eq(tags.id, id));
  res.json({ success: true });
});

// GET /admin/products/:id/tags
router.get("/admin/products/:id/tags", requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(paramString(req.params, "id"));
  if (!Number.isInteger(productId) || productId <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const rows = await db
    .select({ tagId: productTags.tagId })
    .from(productTags)
    .where(eq(productTags.productId, productId));
  res.json({ tagIds: rows.map((r) => r.tagId) });
});

// PUT /admin/products/:id/tags — bulk replace
router.put("/admin/products/:id/tags", requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(paramString(req.params, "id"));
  if (!Number.isInteger(productId) || productId <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { tagIds } = req.body as { tagIds: number[] };
  if (!Array.isArray(tagIds)) { res.status(400).json({ error: "tagIds must be an array" }); return; }

  await db.transaction(async (tx) => {
    await tx.delete(productTags).where(eq(productTags.productId, productId));
    if (tagIds.length > 0) {
      await tx.insert(productTags).values(tagIds.map((tagId) => ({ productId, tagId })));
    }
  });

  res.json({ success: true });
});

export default router;
