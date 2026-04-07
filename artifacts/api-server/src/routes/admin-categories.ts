import { Router } from "express";
import { db } from "@workspace/db";
import { categories, categoryMeta } from "@workspace/db/schema";
import { products } from "@workspace/db/schema";
import { eq, asc, sql, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/categories", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
      metaId: categoryMeta.id,
      displayName: categoryMeta.displayName,
      showInNav: categoryMeta.showInNav,
      metaSortOrder: categoryMeta.sortOrder,
      heroImageUrl: categoryMeta.heroImageUrl,
      bannerText: categoryMeta.bannerText,
      productCount: sql<number>`(
        SELECT COUNT(*)::int FROM products p WHERE p.category_id = ${categories.id}
      )`,
    })
    .from(categories)
    .leftJoin(categoryMeta, eq(categoryMeta.categoryId, categories.id))
    .orderBy(asc(categoryMeta.sortOrder), asc(categories.sortOrder), asc(categories.name));

  res.json({ categories: rows });
});

router.get("/admin/categories/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID" });
    return;
  }

  const [row] = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      imageUrl: categories.imageUrl,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      metaId: categoryMeta.id,
      displayName: categoryMeta.displayName,
      showInNav: categoryMeta.showInNav,
      metaSortOrder: categoryMeta.sortOrder,
      heroImageUrl: categoryMeta.heroImageUrl,
      bannerText: categoryMeta.bannerText,
      seoKeywords: categoryMeta.seoKeywords,
    })
    .from(categories)
    .leftJoin(categoryMeta, eq(categoryMeta.categoryId, categories.id))
    .where(eq(categories.id, id));

  if (!row) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const parentOptions = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(sql`${categories.id} != ${id}`)
    .orderBy(asc(categories.name));

  res.json({ category: row, parentOptions });
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
      slug: body.slug,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      parentId: body.parentId || null,
      sortOrder: Number(body.sortOrder) || 0,
      isActive: Boolean(body.isActive),
      updatedAt: new Date(),
    })
    .where(eq(categories.id, id));

  const [existingMeta] = await db
    .select({ id: categoryMeta.id })
    .from(categoryMeta)
    .where(eq(categoryMeta.categoryId, id));

  const metaData = {
    displayName: body.displayName ?? null,
    showInNav: body.showInNav !== false,
    sortOrder: Number(body.metaSortOrder ?? body.sortOrder) || 0,
    heroImageUrl: body.heroImageUrl ?? null,
    bannerText: body.bannerText ?? null,
    seoKeywords: body.seoKeywords ?? null,
    updatedAt: new Date(),
  };

  if (existingMeta) {
    await db.update(categoryMeta).set(metaData).where(eq(categoryMeta.categoryId, id));
  } else {
    await db.insert(categoryMeta).values({ categoryId: id, ...metaData });
  }

  res.json({ success: true });
});

router.patch("/admin/categories/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid category ID" });
    return;
  }

  const [meta] = await db
    .select({ id: categoryMeta.id, showInNav: categoryMeta.showInNav })
    .from(categoryMeta)
    .where(eq(categoryMeta.categoryId, id));

  if (meta) {
    await db
      .update(categoryMeta)
      .set({ showInNav: !meta.showInNav, updatedAt: new Date() })
      .where(eq(categoryMeta.categoryId, id));
    res.json({ showInNav: !meta.showInNav });
  } else {
    await db.insert(categoryMeta).values({ categoryId: id, showInNav: false });
    res.json({ showInNav: false });
  }
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
      slug: body.slug,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      sortOrder: Number(body.sortOrder) || 0,
      isActive: body.isActive !== false,
    })
    .returning();

  await db.insert(categoryMeta).values({
    categoryId: created.id,
    displayName: body.displayName ?? body.name,
    showInNav: body.showInNav !== false,
    sortOrder: Number(body.sortOrder) || 0,
  });

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
