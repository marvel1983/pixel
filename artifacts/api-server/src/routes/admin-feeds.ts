import { Router } from "express";
import { createReadStream, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { eq, desc, and, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { productFeeds, products, productVariants, categories } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { runFeedGeneration } from "../services/feed-generator";
import { evaluateFilters } from "../services/feed-engine/filter-evaluator";
import { enrichProduct } from "../services/feed-engine/transformer";
import { CHANNEL_PRESETS, PRODUCT_ATTRIBUTES, FILTER_FIELDS } from "../services/feed-engine/channel-presets";
import { logger } from "../lib/logger";
import { paramString } from "../lib/route-params";

const router = Router();
const FEED_DIR = process.env.FEED_OUTPUT_DIR ?? join(process.cwd(), "feeds");

// ── Public feed delivery ──────────────────────────────────────────────────────
router.get("/feeds/:slug", async (req, res) => {
  const slug = paramString(req.params, "slug").replace(/\.(xml|csv)$/, "");
  const token = req.query.token as string | undefined;

  const [feed] = await db.select({ id: productFeeds.id, slug: productFeeds.slug, format: productFeeds.format, accessToken: productFeeds.accessToken, status: productFeeds.status, outputPath: productFeeds.outputPath })
    .from(productFeeds).where(eq(productFeeds.slug, slug));

  if (!feed || feed.accessToken !== token) { res.status(403).json({ error: "Forbidden" }); return; }
  if (feed.status !== "active" || !feed.outputPath || !existsSync(feed.outputPath)) {
    res.status(404).json({ error: "Feed not yet generated" }); return;
  }
  const mime = feed.format === "csv" ? "text/csv" : "application/xml";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "public, max-age=3600");
  createReadStream(feed.outputPath).pipe(res);
});

// ── Admin: meta ───────────────────────────────────────────────────────────────
router.get("/admin/feeds/meta", requireAuth, requireAdmin, (_req, res) => {
  res.json({ channelPresets: CHANNEL_PRESETS, productAttributes: PRODUCT_ATTRIBUTES, filterFields: FILTER_FIELDS });
});

// ── Admin: CRUD ───────────────────────────────────────────────────────────────
router.get("/admin/feeds", requireAuth, requireAdmin, requirePermission("manageProducts"), async (_req, res) => {
  const rows = await db.select().from(productFeeds).orderBy(desc(productFeeds.createdAt));
  res.json({ feeds: rows });
});

router.post("/admin/feeds", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const { name, channelType = "google_shopping", format = "xml", storeUrl = "" } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const accessToken = randomBytes(24).toString("hex");
  const [feed] = await db.insert(productFeeds).values({ name: name.trim(), slug, accessToken, channelType, format, storeUrl }).returning();
  res.json({ feed });
});

router.get("/admin/feeds/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  const [feed] = await db.select().from(productFeeds).where(eq(productFeeds.id, id));
  if (!feed) { res.status(404).json({ error: "Feed not found" }); return; }
  const feedUrl = `${process.env.APP_PUBLIC_URL ?? ""}/api/feeds/${feed.slug}?token=${feed.accessToken}`;
  res.json({ feed, feedUrl });
});

router.put("/admin/feeds/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  const { name, channelType, format, targetCountry, targetLocale, refreshInterval, includeVariations, fieldMappings, filterRules, currencyConfig, storeUrl } = req.body;
  const [feed] = await db.update(productFeeds).set({
    ...(name && { name }),
    ...(channelType && { channelType }),
    ...(format && { format }),
    ...(targetCountry !== undefined && { targetCountry }),
    ...(targetLocale !== undefined && { targetLocale }),
    ...(refreshInterval && { refreshInterval }),
    ...(includeVariations !== undefined && { includeVariations }),
    ...(fieldMappings && { fieldMappings }),
    ...(filterRules && { filterRules }),
    ...(currencyConfig && { currencyConfig }),
    ...(storeUrl !== undefined && { storeUrl }),
    updatedAt: new Date(),
  }).where(eq(productFeeds.id, id)).returning();
  if (!feed) { res.status(404).json({ error: "Feed not found" }); return; }
  res.json({ feed });
});

router.delete("/admin/feeds/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  await db.delete(productFeeds).where(eq(productFeeds.id, id));
  res.json({ success: true });
});

// ── Generate ──────────────────────────────────────────────────────────────────
router.post("/admin/feeds/:id/generate", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  const [feed] = await db.select({ id: productFeeds.id, status: productFeeds.status }).from(productFeeds).where(eq(productFeeds.id, id));
  if (!feed) { res.status(404).json({ error: "Feed not found" }); return; }
  if (feed.status === "generating") { res.status(409).json({ error: "Feed is already generating" }); return; }
  // Kick off async — respond immediately
  res.json({ success: true, message: "Feed generation started" });
  runFeedGeneration(id).catch((err) => logger.error({ err, feedId: id }, "Feed generation error"));
});

// ── Preview (filtered count + sample rows) ────────────────────────────────────
router.post("/admin/feeds/:id/preview", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  const [feed] = await db.select().from(productFeeds).where(eq(productFeeds.id, id));
  if (!feed) { res.status(404).json({ error: "Feed not found" }); return; }

  const cfg = feed.currencyConfig ?? { baseCurrency: "USD", targetCurrency: "USD", exchangeRate: 1, taxOffset: 0, rateMode: "manual" };
  const filterRules = feed.filterRules ?? { id: "root", type: "group", condition: "AND", rules: [] };
  const storeUrl = feed.storeUrl ?? "";

  // Sample first 500 products for preview
  const rows = await db.select({
    id: products.id, variantId: productVariants.id, name: products.name,
    variantName: productVariants.name, slug: products.slug, sku: productVariants.sku,
    price: productVariants.priceUsd, stock: productVariants.stockCount,
    imageUrl: products.imageUrl, isActive: products.isActive, category: categories.name,
    platform: productVariants.platform,
  })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.isActive, true), eq(productVariants.isActive, true)))
    .limit(500);

  let matched = 0;
  const sample: Record<string, unknown>[] = [];
  for (const row of rows) {
    const enriched = enrichProduct(row as Record<string, unknown>, cfg, storeUrl);
    if (!evaluateFilters(enriched, filterRules)) continue;
    matched++;
    if (sample.length < 5) sample.push({ id: row.id, name: row.name, sku: row.sku, price: enriched.price, stock: row.stock, availability: enriched.availability });
  }
  res.json({ matched, total: rows.length, sample });
});

export default router;
