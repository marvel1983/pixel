import { Router } from "express";
import { db } from "@workspace/db";
import { blogPosts, blogCategories, users } from "@workspace/db/schema";
import { eq, desc, sql, ilike, and, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageContent")];

router.get("/admin/blog/posts", ...auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;

    const conditions = [];
    if (status === "published") conditions.push(eq(blogPosts.isPublished, true));
    if (status === "draft") conditions.push(and(eq(blogPosts.isPublished, false), eq(blogPosts.status, "draft"))!);
    if (status === "scheduled") conditions.push(eq(blogPosts.status, "scheduled"));
    if (search) conditions.push(or(ilike(blogPosts.title, `%${search}%`), ilike(blogPosts.slug, `%${search}%`))!);
    if (categoryId) conditions.push(eq(blogPosts.categoryId, parseInt(categoryId)));

    const where = conditions.length ? and(...conditions) : undefined;
    const [posts, countResult] = await Promise.all([
      db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug,
        status: blogPosts.status, isPublished: blogPosts.isPublished,
        publishedAt: blogPosts.publishedAt, scheduledAt: blogPosts.scheduledAt,
        viewCount: blogPosts.viewCount, createdAt: blogPosts.createdAt,
        categoryName: blogCategories.name, authorName: users.firstName,
      })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
        .leftJoin(users, eq(blogPosts.authorId, users.id))
        .where(where)
        .orderBy(desc(blogPosts.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(blogPosts).where(where),
    ]);
    res.json({ posts, total: countResult[0]?.count || 0, page, totalPages: Math.ceil((countResult[0]?.count || 0) / limit) });
  } catch {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.get("/admin/blog/posts/:id", ...auth, async (req, res) => {
  try {
    const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, parseInt(paramString(req.params, "id"))));
    if (!rows.length) return res.status(404).json({ error: "Post not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

router.post("/admin/blog/posts", ...auth, async (req, res) => {
  try {
    const { title, slug, excerpt, content, coverImageUrl, categoryId, tags, status, seoTitle, seoDescription, scheduledAt } = req.body;
    const isPublished = status === "published";
    const isScheduled = status === "scheduled" && scheduledAt;
    const [post] = await db.insert(blogPosts).values({
      title, slug, excerpt, content, coverImageUrl,
      categoryId: categoryId || null, authorId: req.user!.userId,
      tags: tags || null, status: status || "draft",
      isPublished, publishedAt: isPublished ? new Date() : null,
      scheduledAt: isScheduled ? new Date(scheduledAt) : null,
      seoTitle, seoDescription,
    }).returning();
    res.json(post);
  } catch (err) {
    if (err instanceof Error && "constraint" in err && String((err as Record<string, unknown>).constraint).includes("slug"))
      return res.status(400).json({ error: "Slug already exists" });
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.put("/admin/blog/posts/:id", ...auth, async (req, res) => {
  try {
    const id = parseInt(paramString(req.params, "id"));
    const { title, slug, excerpt, content, coverImageUrl, categoryId, tags, status, seoTitle, seoDescription, scheduledAt } = req.body;
    const isPublished = status === "published";
    const isScheduled = status === "scheduled" && scheduledAt;
    const existing = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    if (!existing.length) return res.status(404).json({ error: "Post not found" });

    const publishedAt = isPublished && !existing[0].publishedAt ? new Date() : existing[0].publishedAt;
    const [post] = await db.update(blogPosts).set({
      title, slug, excerpt, content, coverImageUrl,
      categoryId: categoryId || null, tags: tags || null,
      status: status || "draft", isPublished,
      publishedAt: isPublished ? publishedAt : null,
      scheduledAt: isScheduled ? new Date(scheduledAt) : null,
      seoTitle, seoDescription, updatedAt: new Date(),
    }).where(eq(blogPosts.id, id)).returning();
    res.json(post);
  } catch (err) {
    if (err instanceof Error && "constraint" in err && String((err as Record<string, unknown>).constraint).includes("slug"))
      return res.status(400).json({ error: "Slug already exists" });
    res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/admin/blog/posts/:id", ...auth, async (req, res) => {
  try {
    await db.delete(blogPosts).where(eq(blogPosts.id, parseInt(paramString(req.params, "id"))));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete post" });
  }
});

router.get("/admin/blog/categories", ...auth, async (_req, res) => {
  try {
    const categories = await db.select().from(blogCategories).orderBy(blogCategories.sortOrder);
    res.json({ categories });
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/admin/blog/categories", ...auth, async (req, res) => {
  try {
    const { name, slug, description, sortOrder } = req.body;
    const [cat] = await db.insert(blogCategories).values({
      name, slug, description, sortOrder: sortOrder || 0,
    }).returning();
    res.json(cat);
  } catch (err) {
    if (err instanceof Error && "constraint" in err && String((err as Record<string, unknown>).constraint).includes("slug"))
      return res.status(400).json({ error: "Slug already exists" });
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/admin/blog/categories/:id", ...auth, async (req, res) => {
  try {
    const { name, slug, description, sortOrder } = req.body;
    const [cat] = await db.update(blogCategories).set({ name, slug, description, sortOrder })
      .where(eq(blogCategories.id, parseInt(paramString(req.params, "id")))).returning();
    res.json(cat);
  } catch (err) {
    if (err instanceof Error && "constraint" in err && String((err as Record<string, unknown>).constraint).includes("slug"))
      return res.status(400).json({ error: "Slug already exists" });
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/admin/blog/categories/:id", ...auth, async (req, res) => {
  try {
    await db.update(blogPosts).set({ categoryId: null })
      .where(eq(blogPosts.categoryId, parseInt(paramString(req.params, "id"))));
    await db.delete(blogCategories).where(eq(blogCategories.id, parseInt(paramString(req.params, "id"))));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
