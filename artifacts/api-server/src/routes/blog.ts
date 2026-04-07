import { Router } from "express";
import { db } from "@workspace/db";
import { blogPosts, blogCategories, users } from "@workspace/db/schema";
import { eq, desc, and, sql, ilike, or, lte } from "drizzle-orm";

const router = Router();

router.get("/blog/posts", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 12);
    const offset = (page - 1) * limit;
    const category = req.query.category as string | undefined;
    const tag = req.query.tag as string | undefined;
    const search = req.query.search as string | undefined;

    await db.update(blogPosts).set({ isPublished: true, status: "published", publishedAt: new Date() })
      .where(and(eq(blogPosts.status, "scheduled"), lte(blogPosts.scheduledAt, new Date())));

    const conditions = [eq(blogPosts.isPublished, true)];
    if (category) {
      const cat = await db.select().from(blogCategories).where(eq(blogCategories.slug, category)).limit(1);
      if (!cat.length) return res.json({ posts: [], total: 0, page, totalPages: 0 });
      conditions.push(eq(blogPosts.categoryId, cat[0].id));
    }
    if (tag) {
      conditions.push(ilike(blogPosts.tags, `%${tag}%`));
    }
    if (search) {
      conditions.push(or(ilike(blogPosts.title, `%${search}%`), ilike(blogPosts.excerpt, `%${search}%`))!);
    }

    const where = and(...conditions);
    const [posts, countResult] = await Promise.all([
      db.select({
        id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug,
        excerpt: blogPosts.excerpt, coverImageUrl: blogPosts.coverImageUrl,
        tags: blogPosts.tags, publishedAt: blogPosts.publishedAt,
        viewCount: blogPosts.viewCount,
        categoryName: blogCategories.name, categorySlug: blogCategories.slug,
        authorName: users.firstName,
      })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
        .leftJoin(users, eq(blogPosts.authorId, users.id))
        .where(where)
        .orderBy(desc(blogPosts.publishedAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(blogPosts).where(where),
    ]);

    const total = countResult[0]?.count || 0;
    res.json({ posts, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

router.get("/blog/posts/:slug", async (req, res) => {
  try {
    const rows = await db.select({
      id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug,
      excerpt: blogPosts.excerpt, content: blogPosts.content,
      coverImageUrl: blogPosts.coverImageUrl, tags: blogPosts.tags,
      publishedAt: blogPosts.publishedAt, viewCount: blogPosts.viewCount,
      seoTitle: blogPosts.seoTitle, seoDescription: blogPosts.seoDescription,
      categoryName: blogCategories.name, categorySlug: blogCategories.slug,
      authorName: users.firstName,
    })
      .from(blogPosts)
      .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
      .leftJoin(users, eq(blogPosts.authorId, users.id))
      .where(and(eq(blogPosts.slug, req.params.slug), eq(blogPosts.isPublished, true)))
      .limit(1);

    if (!rows.length) return res.status(404).json({ error: "Post not found" });

    await db.update(blogPosts).set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.slug, req.params.slug));

    const post = rows[0];
    const related = await db.select({
      id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug,
      excerpt: blogPosts.excerpt, coverImageUrl: blogPosts.coverImageUrl,
      publishedAt: blogPosts.publishedAt,
    })
      .from(blogPosts)
      .where(and(eq(blogPosts.isPublished, true), sql`${blogPosts.id} != ${post.id}`))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(3);

    res.json({ post, related });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

router.get("/blog/categories", async (_req, res) => {
  try {
    const categories = await db.select().from(blogCategories).orderBy(blogCategories.sortOrder);
    res.json({ categories });
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/blog/tags", async (_req, res) => {
  try {
    const posts = await db.select({ tags: blogPosts.tags }).from(blogPosts)
      .where(eq(blogPosts.isPublished, true));
    const tagMap = new Map<string, number>();
    for (const p of posts) {
      if (!p.tags) continue;
      for (const t of p.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      }
    }
    const tags = [...tagMap.entries()].map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    res.json({ tags });
  } catch {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.get("/blog/rss.xml", async (_req, res) => {
  try {
    const posts = await db.select({
      title: blogPosts.title, slug: blogPosts.slug, excerpt: blogPosts.excerpt,
      publishedAt: blogPosts.publishedAt,
    }).from(blogPosts)
      .where(eq(blogPosts.isPublished, true))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(20);

    const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || "pixelcodes.com"}`;
    const items = posts.map((p) => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${baseUrl}/blog/${p.slug}</link>
      <description><![CDATA[${p.excerpt || ""}]]></description>
      <pubDate>${p.publishedAt ? new Date(p.publishedAt).toUTCString() : ""}</pubDate>
      <guid>${baseUrl}/blog/${p.slug}</guid>
    </item>`).join("");

    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PixelCodes Blog</title>
    <link>${baseUrl}/blog</link>
    <description>Software tips, guides, and news from PixelCodes</description>
    <language>en</language>
    ${items}
  </channel>
</rss>`);
  } catch {
    res.status(500).send("RSS feed error");
  }
});

export default router;
