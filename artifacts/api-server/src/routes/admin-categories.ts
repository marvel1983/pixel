import { Router } from "express";
import { db } from "@workspace/db";
import { categories } from "@workspace/db/schema";
import { products } from "@workspace/db/schema";
import { eq, asc, sql, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/categories", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      displayName: categories.displayName,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      metaTitle: categories.metaTitle,
      metaDescription: categories.metaDescription,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      showInNav: categories.showInNav,
      createdAt: categories.createdAt,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM products p WHERE p.category_id = ${categories.id}
      )`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  res.json({ categories: rows });
});

router.get("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID" });
    return;
  }

  const [category] = await db.select().from(categories).where(eq(categories.id, id));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const allCats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(sql`${categories.id} != ${id}`)
    .orderBy(asc(categories.name));

  res.json({ category, parentOptions: allCats });
});

router.put("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID" });
    return;
  }

  const body = req.body;
  await db
    .update(categories)
    .set({
      name: body.name,
      displayName: body.displayName ?? null,
      slug: body.slug,
      showInNav: Boolean(body.showInNav),
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      metaTitle: body.metaTitle ?? null,
      metaDescription: body.metaDescription ?? null,
      parentId: body.parentId || null,
      sortOrder: Number(body.sortOrder) || 0,
      isActive: Boolean(body.isActive),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id));

  res.json({ success: true });
});

router.patch("/admin/categories/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID" });
    return;
  }

  const [cat] = await db
    .select({ showInNav: categories.showInNav })
    .from(categories)
    .where(eq(categories.id, id));

  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  await db
    .update(categories)
    .set({ showInNav: !cat.showInNav, updatedAt: new Date() })
    .where(eq(categories.id, id));

  res.json({ showInNav: !cat.showInNav });
});

router.post("/admin/categories", requireAuth, requireAdmin, async (req, res) => {
  const body = req.body;
  if (!body.name || !body.slug) {
    res.status(400).json({ error: "Name and slug are required" });
    return;
  }

  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, body.slug));

  if (existing) {
    res.status(409).json({ error: "A category with this slug already exists" });
    return;
  }

  const [created] = await db
    .insert(categories)
    .values({
      name: body.name,
      displayName: body.displayName ?? body.name,
      slug: body.slug,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      sortOrder: Number(body.sortOrder) || 0,
      isActive: body.isActive !== false,
      showInNav: body.showInNav !== false,
    })
    .returning();

  res.status(201).json({ category: created });
});

router.delete("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID" });
    return;
  }

  const [{ productCount }] = await db
    .select({ productCount: count() })
    .from(products)
    .where(eq(products.categoryId, id));

  if (productCount > 0) {
    res.status(409).json({ error: `Cannot delete: ${productCount} products use this category` });
    return;
  }

  await db.delete(categories).where(eq(categories.id, id));
  res.json({ success: true });
});

export default router;
