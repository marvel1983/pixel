import { Router } from "express";
import { db } from "@workspace/db";
import { pages, faqs } from "@workspace/db/schema";
import { eq, asc, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/pages", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.id));
  const [{ total }] = await db.select({ total: count() }).from(pages);
  res.json({ pages: rows, total });
});

router.get("/admin/pages/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [page] = await db.select().from(pages).where(eq(pages.id, id));
  if (!page) { res.status(404).json({ error: "Page not found" }); return; }
  res.json({ page });
});

router.put("/admin/pages/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { title, slug, content, metaTitle, metaDescription, isPublished, sortOrder } = req.body;
  if (!title || typeof title !== "string") { res.status(400).json({ error: "Title required" }); return; }
  const updateData: Record<string, unknown> = {
    title: title.trim(),
    content: content ?? null,
    metaTitle: metaTitle ? String(metaTitle).slice(0, 60) : null,
    metaDescription: metaDescription ? String(metaDescription).slice(0, 160) : null,
    isPublished: isPublished !== false,
    sortOrder: Number(sortOrder) || 0,
    updatedAt: new Date(),
  };
  if (slug && typeof slug === "string") {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    const [dup] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, cleanSlug));
    if (dup && dup.id !== id) { res.status(409).json({ error: "Slug already exists" }); return; }
    updateData.slug = cleanSlug;
  }
  await db.update(pages).set(updateData).where(eq(pages.id, id));
  const [updated] = await db.select().from(pages).where(eq(pages.id, id));
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ page: updated });
});

router.post("/admin/pages", requireAuth, requireAdmin, async (req, res) => {
  const { title, slug } = req.body;
  if (!title || !slug) { res.status(400).json({ error: "Title and slug required" }); return; }
  const [existing] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, String(slug).trim()));
  if (existing) { res.status(409).json({ error: "Slug already exists" }); return; }
  const [page] = await db.insert(pages).values({
    title: String(title).trim(),
    slug: String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, ""),
    content: req.body.content ?? "",
    metaTitle: req.body.metaTitle ? String(req.body.metaTitle).slice(0, 60) : null,
    metaDescription: req.body.metaDescription ? String(req.body.metaDescription).slice(0, 160) : null,
    isPublished: req.body.isPublished !== false,
    sortOrder: Number(req.body.sortOrder) || 0,
  }).returning();
  res.json({ page });
});

router.delete("/admin/pages/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(pages).where(eq(pages.id, id));
  res.json({ success: true });
});

router.get("/admin/faqs", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(faqs).orderBy(asc(faqs.sortOrder), asc(faqs.id));
  res.json({ faqs: rows });
});

router.put("/admin/faqs/bulk", requireAuth, requireAdmin, async (req, res) => {
  const items = req.body.faqs;
  if (!Array.isArray(items)) { res.status(400).json({ error: "faqs array required" }); return; }
  await db.delete(faqs);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.question || !item.answer) continue;
    await db.insert(faqs).values({
      question: String(item.question),
      answer: String(item.answer),
      categoryLabel: item.categoryLabel || null,
      sortOrder: i,
      isActive: item.isActive !== false,
    });
  }
  const rows = await db.select().from(faqs).orderBy(asc(faqs.sortOrder));
  res.json({ faqs: rows });
});

router.get("/pages/:slug", async (req, res) => {
  const slug = String(req.params.slug);
  const [page] = await db.select().from(pages).where(eq(pages.slug, slug));
  if (!page || !page.isPublished) { res.status(404).json({ error: "Page not found" }); return; }
  res.json({ page });
});

router.get("/faqs", async (_req, res) => {
  const rows = await db.select().from(faqs).where(eq(faqs.isActive, true)).orderBy(asc(faqs.sortOrder));
  res.json({ faqs: rows });
});

router.post("/admin/pages/seed", requireAuth, requireAdmin, async (_req, res) => {
  const defaultPages = [
    { title: "About Us", slug: "about-us", sortOrder: 0 },
    { title: "Terms of Service", slug: "terms", sortOrder: 1 },
    { title: "Privacy Policy", slug: "privacy-policy", sortOrder: 2 },
    { title: "Refund Policy", slug: "refund-policy", sortOrder: 3 },
    { title: "Delivery Terms", slug: "delivery-terms", sortOrder: 4 },
    { title: "Payment Methods", slug: "payment-methods", sortOrder: 5 },
    { title: "FAQ", slug: "faq", sortOrder: 6 },
    { title: "How to Buy", slug: "how-to-buy", sortOrder: 7 },
    { title: "Reseller Application", slug: "reseller-application", sortOrder: 8 },
    { title: "Contact", slug: "contact", sortOrder: 9 },
  ];
  let seeded = 0;
  for (const p of defaultPages) {
    const [existing] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, p.slug));
    if (!existing) {
      await db.insert(pages).values({ ...p, content: `<h1>${p.title}</h1><p>Content coming soon.</p>`, isPublished: true });
      seeded++;
    }
  }
  res.json({ success: true, seeded });
});

export default router;
