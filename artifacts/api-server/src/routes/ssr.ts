import { Router } from "express";
import { db } from "@workspace/db";
import { products, categories, bundles, productVariants } from "@workspace/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { renderSeoHtml, esc, plain, SITE_URL, type SeoDoc } from "../lib/ssr-render";
import { logger } from "../lib/logger";

const router = Router();
// Env-driven so the same code serves both storefronts (Pixel / SWC).
const SITE_NAME = process.env.SITE_NAME ?? "PixelCodes";

function send(res: import("express").Response, doc: SeoDoc) {
  res.set("Content-Type", "text/html; charset=utf-8");
  // Crawler snapshots can be cached at the edge briefly.
  res.set("Cache-Control", "public, max-age=300, s-maxage=300");
  res.send(renderSeoHtml(doc));
}

function priceFrom(rows: { priceUsd: string }[]): string | null {
  const nums = rows.map((r) => parseFloat(r.priceUsd)).filter((n) => Number.isFinite(n));
  return nums.length ? Math.min(...nums).toFixed(2) : null;
}

async function renderProduct(slug: string): Promise<SeoDoc | null> {
  const [p] = await db
    .select({
      id: products.id, name: products.name, slug: products.slug,
      description: products.description, imageUrl: products.imageUrl,
      metaTitle: products.metaTitle, metaDescription: products.metaDescription,
      avgRating: products.avgRating, reviewCount: products.reviewCount,
      categorySlug: sql<string | null>`(SELECT slug FROM categories WHERE id = ${products.categoryId})`,
      categoryName: sql<string | null>`(SELECT name FROM categories WHERE id = ${products.categoryId})`,
    })
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);
  if (!p) return null;

  const vars = await db
    .select({ priceUsd: productVariants.priceUsd, name: productVariants.name, platform: productVariants.platform })
    .from(productVariants)
    .where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true)));
  const from = priceFrom(vars);

  const title = p.metaTitle || `${p.name} — Genuine Key, Instant Delivery | ${SITE_NAME}`;
  const description =
    p.metaDescription ||
    plain(p.description) ||
    `Buy ${p.name} — genuine license key with instant email delivery, lifetime activation and 24/7 support.`;
  const canonical = `/product/${p.slug}`;

  const jsonLd: object[] = [
    {
      "@context": "https://schema.org", "@type": "Product",
      name: p.name, image: p.imageUrl ? `${SITE_URL}${p.imageUrl}` : undefined,
      description: plain(p.description) || description,
      brand: { "@type": "Brand", name: SITE_NAME },
      ...(from
        ? { offers: { "@type": "Offer", price: from, priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${SITE_URL}${canonical}`, seller: { "@type": "Organization", name: SITE_NAME } } }
        : {}),
      ...(Number(p.reviewCount) > 0
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(p.avgRating ?? 0), reviewCount: Number(p.reviewCount), bestRating: 5 } }
        : {}),
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Shop", item: `${SITE_URL}/shop` },
        ...(p.categorySlug ? [{ "@type": "ListItem", position: 2, name: p.categoryName, item: `${SITE_URL}/category/${p.categorySlug}` }] : []),
        { "@type": "ListItem", position: p.categorySlug ? 3 : 2, name: p.name, item: `${SITE_URL}${canonical}` },
      ],
    },
  ];

  const bodyHtml = `
    <main>
      <nav aria-label="Breadcrumb"><a href="/shop">Shop</a>${p.categorySlug ? ` › <a href="/category/${esc(p.categorySlug)}">${esc(p.categoryName)}</a>` : ""} › <span>${esc(p.name)}</span></nav>
      <h1>${esc(p.name)}</h1>
      ${from ? `<p><strong>From €${esc(from)}</strong> — instant email delivery, genuine retail key, lifetime activation.</p>` : ""}
      ${Number(p.reviewCount) > 0 ? `<p>Rated ${esc(Number(p.avgRating ?? 0).toFixed(1))}/5 from ${esc(p.reviewCount)} verified reviews.</p>` : ""}
      <div>${plain(p.description, 1200) ? `<p>${esc(plain(p.description, 1200))}</p>` : ""}</div>
      ${vars.length ? `<h2>Editions</h2><ul>${vars.map((v) => `<li>${esc(v.name)}${v.platform ? ` (${esc(v.platform)})` : ""} — €${esc(parseFloat(v.priceUsd).toFixed(2))}</li>`).join("")}</ul>` : ""}
      <p><a href="${esc(canonical)}">Buy ${esc(p.name)} now →</a></p>
    </main>`;

  return { title, description, canonical, ogImage: p.imageUrl, ogType: "product", jsonLd, bodyHtml };
}

async function renderCategory(slug: string): Promise<SeoDoc | null> {
  const [c] = await db
    .select({ id: categories.id, name: categories.name, slug: categories.slug, description: categories.description, metaTitle: categories.metaTitle, metaDescription: categories.metaDescription })
    .from(categories).where(eq(categories.slug, slug)).limit(1);
  if (!c) return null;

  const list = await db
    .select({ name: products.name, slug: products.slug })
    .from(products)
    .where(and(eq(products.categoryId, c.id), eq(products.isActive, true)))
    .orderBy(asc(products.name)).limit(60);

  const title = c.metaTitle || `${c.name} — Cheap Genuine Keys | ${SITE_NAME}`;
  const description = c.metaDescription || plain(c.description) || `Shop ${c.name} license keys. Genuine, instant email delivery, lifetime activation.`;
  const canonical = `/category/${c.slug}`;

  return {
    title, description, canonical,
    jsonLd: [{
      "@context": "https://schema.org", "@type": "CollectionPage",
      name: c.name, description, url: `${SITE_URL}${canonical}`,
    }],
    bodyHtml: `<main><h1>${esc(c.name)}</h1><p>${esc(description)}</p><ul>${list.map((x) => `<li><a href="/product/${esc(x.slug)}">${esc(x.name)}</a></li>`).join("")}</ul></main>`,
  };
}

async function renderBundle(slug: string): Promise<SeoDoc | null> {
  const [b] = await db
    .select({ name: bundles.name, slug: bundles.slug, description: bundles.description, shortDescription: bundles.shortDescription, bundlePriceUsd: bundles.bundlePriceUsd, metaTitle: bundles.metaTitle, metaDescription: bundles.metaDescription })
    .from(bundles).where(and(eq(bundles.slug, slug), eq(bundles.isActive, true))).limit(1);
  if (!b) return null;
  const title = b.metaTitle || `${b.name} Bundle — Save More | ${SITE_NAME}`;
  const description = b.metaDescription || plain(b.shortDescription || b.description) || `Get the ${b.name} bundle and save. Genuine keys, instant delivery.`;
  const canonical = `/bundles/${b.slug}`;
  return {
    title, description, canonical, ogType: "product",
    jsonLd: [{ "@context": "https://schema.org", "@type": "Product", name: b.name, description, offers: { "@type": "Offer", price: b.bundlePriceUsd, priceCurrency: "EUR", availability: "https://schema.org/InStock", url: `${SITE_URL}${canonical}` } }],
    bodyHtml: `<main><h1>${esc(b.name)}</h1><p>${esc(description)}</p><p><strong>Bundle price €${esc(b.bundlePriceUsd)}</strong></p><p><a href="${esc(canonical)}">View bundle →</a></p></main>`,
  };
}

function siteDoc(canonical: string, title: string, description: string): SeoDoc {
  return {
    title, description, canonical,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: SITE_URL, potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` }, "query-input": "required name=search_term_string" } },
    ],
    bodyHtml: `<main><h1>${esc(title)}</h1><p>${esc(description)}</p></main>`,
  };
}

// Nginx proxies crawler traffic to /__ssr<original-path>.
router.get(/^\/__ssr(\/.*)?$/, async (req, res) => {
  const rawPath = (req.params[0] || "/").split("?")[0];
  try {
    let doc: SeoDoc | null = null;
    const m = rawPath.match(/^\/(product|category|bundles)\/([^/]+)\/?$/);
    if (m) {
      const [, kind, slug] = m;
      const s = decodeURIComponent(slug);
      doc = kind === "product" ? await renderProduct(s)
        : kind === "category" ? await renderCategory(s)
        : await renderBundle(s);
    }
    if (!doc) {
      if (rawPath === "/" || rawPath === "") {
        doc = siteDoc("/", `${SITE_NAME} — Genuine Software Keys, Instant Email Delivery`, "Buy genuine Windows, Office, antivirus and PC game keys. Instant email delivery, lifetime activation, 24/7 support. Trusted by 50,000+ customers.");
      } else if (rawPath.startsWith("/shop")) {
        doc = siteDoc("/shop", `Shop All Software Keys | ${SITE_NAME}`, "Browse genuine Windows, Office, antivirus, VPN and PC game license keys. Instant delivery.");
      } else if (rawPath.startsWith("/bundles")) {
        doc = siteDoc("/bundles", `Software Bundles — Save More | ${SITE_NAME}`, "Save more when you buy software license keys together. Genuine keys, instant delivery.");
      } else {
        // Unknown route: serve the shell with site meta, noindex to avoid thin pages.
        doc = { ...siteDoc(rawPath, `${SITE_NAME}`, "Genuine software license keys, instant email delivery."), noindex: true };
      }
    }
    send(res, doc);
  } catch (err) {
    logger.error({ err, path: rawPath }, "SSR render failed");
    // Fall back to the plain shell so the bot still gets a valid page.
    send(res, { ...siteDoc(rawPath, SITE_NAME, "Genuine software license keys."), noindex: true });
  }
});

export default router;
