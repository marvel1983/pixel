import { Router } from "express";
import { db } from "@workspace/db";
import { products, categories, blogPosts, pages, seoTracking, productSeoContent } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const STORE = process.env.STORE_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? "https://pixelcodes.com";

function url(path: string, lastmod?: Date | string | null, changefreq = "weekly", priority = "0.7"): string {
  const mod = lastmod ? new Date(lastmod).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
  return `  <url>
    <loc>${STORE}${path}</loc>
    <lastmod>${mod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// Google Search Console HTML verification file
router.get(/^\/google([a-z0-9]+)\.html$/i, async (req, res) => {
  const rows = await db.select({ googleVerificationCode: seoTracking.googleVerificationCode }).from(seoTracking).limit(1);
  const code = rows[0]?.googleVerificationCode?.trim();
  if (!code) { res.status(404).end(); return; }
  // URL must contain the code
  const urlCode = (req.params as Record<string, string>)[0] ?? "";
  if (urlCode.toLowerCase() !== code.toLowerCase()) { res.status(404).end(); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`google-site-verification: google${code}.html`);
});

router.get("/sitemap.xml", async (_req, res) => {
  const [prods, cats, posts, staticPages, buyPages] = await Promise.all([
    db.select({ slug: products.slug, updatedAt: products.updatedAt })
      .from(products)
      .where(eq(products.isActive, true)),
    db.select({ slug: categories.slug, updatedAt: categories.updatedAt })
      .from(categories),
    db.select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, true)),
    db.select({ slug: pages.slug, updatedAt: pages.updatedAt })
      .from(pages)
      .where(eq(pages.isPublished, true)),
    // Programmatic /buy/:slug landing pages — only those with generated
    // unique content (others are noindex and must stay out of the sitemap).
    db.select({ slug: products.slug, updatedAt: productSeoContent.updatedAt })
      .from(productSeoContent)
      .innerJoin(products, eq(products.id, productSeoContent.productId))
      .where(eq(products.isActive, true)),
  ]);

  const urls: string[] = [
    url("/", null, "daily", "1.0"),
    url("/shop", null, "daily", "0.9"),
    url("/hot-offers", null, "daily", "0.9"),
    url("/deals", null, "daily", "0.9"),
    url("/best-sellers", null, "weekly", "0.8"),
    url("/new-arrivals", null, "daily", "0.8"),
    url("/flash-sale", null, "daily", "0.8"),
    url("/bundles", null, "weekly", "0.7"),
    url("/outlet", null, "weekly", "0.7"),
    url("/blog", null, "weekly", "0.6"),
    url("/support", null, "monthly", "0.5"),
    url("/faq", null, "monthly", "0.5"),
    url("/business", null, "monthly", "0.5"),
    ...cats.map((c) => url(`/category/${c.slug}`, c.updatedAt, "daily", "0.8")),
    ...prods.map((p) => url(`/product/${p.slug}`, p.updatedAt, "weekly", "0.7")),
    ...buyPages.map((p) => url(`/buy/${p.slug}`, p.updatedAt, "weekly", "0.8")),
    ...posts.map((p) => url(`/blog/${p.slug}`, p.updatedAt, "monthly", "0.6")),
    ...staticPages.map((p) => url(`/${p.slug}`, p.updatedAt, "monthly", "0.5")),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

export default router;
