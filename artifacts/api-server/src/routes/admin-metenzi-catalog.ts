import { Router } from "express";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  metenziProductMappings,
  products,
  productVariants,
} from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getCatalogPage } from "../lib/metenzi-endpoints";
import { downloadImageToVps } from "../lib/image-downloader";
import { logger } from "../lib/logger";
import { metenziRequest } from "../lib/metenzi-client";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

// ── GET /admin/metenzi/debug ─────────────────────────────────────────────────
router.get("/admin/metenzi/debug", ...guard, async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Not configured", baseUrl: null }); return; }
  const rawRes = await metenziRequest(config, { method: "GET", path: "/api/public/products", query: { limit: "3", offset: "0" } });
  res.json({ baseUrl: config.baseUrl, ok: rawRes.ok, status: rawRes.status, data: rawRes.data });
});

// ── GET /admin/metenzi/proxy-image ───────────────────────────────────────────
// Proxies Metenzi product images through the server to bypass CORS/auth issues
router.get("/admin/metenzi/proxy-image", ...guard, async (req, res) => {
  let url = String(req.query.url || "");
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) url = `https://metenzi.com${url}`;
  if (!url.startsWith("http://") && !url.startsWith("https://")) { res.status(400).end(); return; }
  try {
    const r = await fetch(url);
    if (!r.ok) { res.status(r.status).end(); return; }
    const ct = r.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch { res.status(502).end(); }
});

// ── GET /admin/metenzi/catalog ───────────────────────────────────────────────
// Proxy paginated Metenzi catalog with mapping status overlay
router.get("/admin/metenzi/catalog", ...guard, async (req, res) => {
  const config = await getMetenziConfig();
  if (!config) {
    res.status(503).json({ error: "Metenzi not configured" });
    return;
  }

  try {
    const page     = Math.max(1, parseInt(req.query.page as string)  || 1);
    const limit    = Math.min(50, Math.max(5, parseInt(req.query.limit as string) || 20));
    const search   = req.query.search   as string | undefined;
    const category = req.query.category as string | undefined;
    const platform = req.query.platform as string | undefined;

    const catalog = await getCatalogPage(config, { page, limit, search, category, platform });

    // Overlay mapping status for each product on this page
    const metenziIds = catalog.products.map((p) => p.id);
    const mappings = metenziIds.length
      ? await db
          .select({
            metenziProductId: metenziProductMappings.metenziProductId,
            pixelProductId:   metenziProductMappings.pixelProductId,
            mappingId:        metenziProductMappings.id,
            autoSyncStock:    metenziProductMappings.autoSyncStock,
          })
          .from(metenziProductMappings)
          .where(inArray(metenziProductMappings.metenziProductId, metenziIds))
      : [];

    const mappingMap = new Map(mappings.map((m) => [m.metenziProductId, m]));

    // Fetch pixel product names for mapped items
    const mappedPixelIds = mappings
      .map((m) => m.pixelProductId)
      .filter((id): id is number => id !== null);

    const pixelProducts = mappedPixelIds.length
      ? await db
          .select({ id: products.id, name: products.name, slug: products.slug })
          .from(products)
          .where(inArray(products.id, mappedPixelIds))
      : [];

    const pixelMap = new Map(pixelProducts.map((p) => [p.id, p]));

    const enriched = catalog.products.map((mp) => {
      const mapping = mappingMap.get(mp.id);
      const pixel   = mapping?.pixelProductId ? pixelMap.get(mapping.pixelProductId) : null;
      return {
        ...mp,
        mapped:       !!mapping,
        mappingId:    mapping?.mappingId ?? null,
        autoSyncStock: mapping?.autoSyncStock ?? false,
        pixelProduct: pixel ?? null,
      };
    });

    res.json({ products: enriched, total: catalog.total, page, limit });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Metenzi catalog");
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

// ── GET /admin/metenzi/catalog/categories ────────────────────────────────────
// Return distinct categories/platforms seen in last full sync (from mappings)
router.get("/admin/metenzi/catalog/meta", ...guard, async (req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.json({ categories: [], platforms: [] }); return; }
  try {
    // Fetch a small page to get category/platform options from live API
    const catalog = await getCatalogPage(config, { limit: 50, page: 1 });
    const categories = [...new Set(catalog.products.map((p) => p.category).filter(Boolean))].sort();
    const platforms  = [...new Set(catalog.products.map((p) => p.platform).filter(Boolean))].sort();
    res.json({ categories, platforms });
  } catch {
    res.json({ categories: [], platforms: [] });
  }
});

// ── GET /admin/metenzi/mappings ──────────────────────────────────────────────
router.get("/admin/metenzi/mappings", ...guard, async (_req, res) => {
  const mappings = await db
    .select({
      id:               metenziProductMappings.id,
      metenziProductId: metenziProductMappings.metenziProductId,
      metenziSku:       metenziProductMappings.metenziSku,
      metenziName:      metenziProductMappings.metenziName,
      pixelProductId:   metenziProductMappings.pixelProductId,
      autoSyncStock:    metenziProductMappings.autoSyncStock,
      lastStockSyncAt:  metenziProductMappings.lastStockSyncAt,
      lastSyncedAt:     metenziProductMappings.lastSyncedAt,
    })
    .from(metenziProductMappings);

  res.json(mappings);
});

// ── POST /admin/metenzi/mappings ─────────────────────────────────────────────
const createMappingSchema = z.object({
  metenziProductId: z.string().min(1),
  metenziSku:       z.string().optional(),
  metenziName:      z.string().optional(),
  pixelProductId:   z.number().int().positive(),
});

router.post("/admin/metenzi/mappings", ...guard, async (req, res) => {
  const parsed = createMappingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }

  const { metenziProductId, metenziSku, metenziName, pixelProductId } = parsed.data;

  // Remove any existing mapping for this Metenzi product first
  await db
    .delete(metenziProductMappings)
    .where(eq(metenziProductMappings.metenziProductId, metenziProductId));

  const [mapping] = await db
    .insert(metenziProductMappings)
    .values({ metenziProductId, metenziSku, metenziName, pixelProductId })
    .returning();

  res.json(mapping);
});

// ── DELETE /admin/metenzi/mappings/:id ───────────────────────────────────────
router.delete("/admin/metenzi/mappings/:id", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(metenziProductMappings).where(eq(metenziProductMappings.id, id));
  res.json({ success: true });
});

// ── PATCH /admin/metenzi/mappings/:id ────────────────────────────────────────
router.patch("/admin/metenzi/mappings/:id", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof req.body.autoSyncStock === "boolean") updates.autoSyncStock = req.body.autoSyncStock;
  if (req.body.pixelProductId !== undefined) updates.pixelProductId = req.body.pixelProductId;

  await db.update(metenziProductMappings).set(updates).where(eq(metenziProductMappings.id, id));
  res.json({ success: true });
});

// ── POST /admin/metenzi/sync-field ───────────────────────────────────────────
const syncFieldSchema = z.object({
  mappingId:      z.number().int().positive(),
  fields:         z.array(z.enum(["name","image","b2bPrice","retailPrice","description","shortDescription","sku","stock"])),
});

router.post("/admin/metenzi/sync-field", ...guard, async (req, res) => {
  const parsed = syncFieldSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }

  const { mappingId, fields } = parsed.data;

  const [mapping] = await db
    .select()
    .from(metenziProductMappings)
    .where(eq(metenziProductMappings.id, mappingId))
    .limit(1);

  if (!mapping || !mapping.pixelProductId) {
    res.status(404).json({ error: "Mapping not found or no Pixel product linked" });
    return;
  }

  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Metenzi not configured" }); return; }

  // Fetch fresh product data from Metenzi
  const catRes = await getCatalogPage(config, { search: mapping.metenziSku ?? mapping.metenziProductId, limit: 5 });
  const mp = catRes.products.find((p) => p.id === mapping.metenziProductId);
  if (!mp) { res.status(404).json({ error: "Product not found in Metenzi" }); return; }

  // Fetch pixel product's variant
  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, mapping.pixelProductId))
    .limit(1);

  const productUpdates: Record<string, unknown> = { updatedAt: new Date() };
  const variantUpdates: Record<string, unknown> = { updatedAt: new Date() };
  const synced: string[] = [];

  for (const field of fields) {
    switch (field) {
      case "name":
        productUpdates.name = mp.name;
        synced.push("name");
        break;
      case "description":
        productUpdates.description = mp.description;
        synced.push("description");
        break;
      case "shortDescription":
        productUpdates.shortDescription = mp.shortDescription;
        synced.push("shortDescription");
        break;
      case "b2bPrice":
        variantUpdates.b2bPriceUsd = mp.b2bPrice;
        synced.push("b2bPrice");
        break;
      case "retailPrice":
        variantUpdates.priceUsd = mp.retailPrice;
        synced.push("retailPrice");
        break;
      case "sku":
        variantUpdates.sku = mp.sku;
        synced.push("sku");
        break;
      case "stock":
        variantUpdates.stockCount = mp.stock;
        synced.push("stock");
        break;
      case "image":
        if (mp.imageUrl) {
          try {
            const localUrl = await downloadImageToVps(mp.imageUrl);
            productUpdates.imageUrl = localUrl;
            synced.push("image");
          } catch (err) {
            logger.warn({ err, imageUrl: mp.imageUrl }, "Image sync failed");
            res.status(500).json({ error: `Image download failed: ${(err as Error).message}` });
            return;
          }
        } else {
          res.status(422).json({ error: "Metenzi product has no imageUrl" });
          return;
        }
        break;
    }
  }

  if (Object.keys(productUpdates).length > 1) {
    await db.update(products).set(productUpdates).where(eq(products.id, mapping.pixelProductId));
  }
  if (variant && Object.keys(variantUpdates).length > 1) {
    await db.update(productVariants).set(variantUpdates).where(eq(productVariants.id, variant.id));
  }

  await db.update(metenziProductMappings)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(metenziProductMappings.id, mappingId));

  res.json({ success: true, synced });
});

// ── POST /admin/metenzi/import ───────────────────────────────────────────────
const importSchema = z.object({
  metenziProductId: z.string().min(1),
  fields: z.array(z.enum(["name","image","b2bPrice","retailPrice","description","shortDescription","sku","stock","category","platform"])),
  pixelCategoryId: z.number().int().positive().optional(),
});

router.post("/admin/metenzi/import", ...guard, async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }

  const { metenziProductId, fields, pixelCategoryId } = parsed.data;

  // Check if already mapped
  const [existing] = await db
    .select({ id: metenziProductMappings.id })
    .from(metenziProductMappings)
    .where(eq(metenziProductMappings.metenziProductId, metenziProductId))
    .limit(1);
  if (existing) { res.status(409).json({ error: "Product already mapped" }); return; }

  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Metenzi not configured" }); return; }

  const catRes = await getCatalogPage(config, { limit: 50 });
  const mp = catRes.products.find((p) => p.id === metenziProductId);
  if (!mp) { res.status(404).json({ error: "Metenzi product not found" }); return; }

  const f = new Set(fields);
  const include = (field: string) => f.has(field);

  // Download image if requested
  let imageUrl: string | null = null;
  if (include("image") && mp.imageUrl) {
    try { imageUrl = await downloadImageToVps(mp.imageUrl); }
    catch (err) { logger.warn({ err, imageUrl: mp.imageUrl }, "Image download failed during import"); }
  }

  // Generate slug from name
  const baseSlug = (include("name") ? mp.name : mp.id)
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Check slug uniqueness
  const [existing2] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.slug, baseSlug))
    .limit(1);
  const slug = existing2 ? `${baseSlug}-${Date.now()}` : baseSlug;

  const [product] = await db
    .insert(products)
    .values({
      name:             include("name")             ? mp.name             : mp.id,
      slug,
      description:      include("description")      ? mp.description      : null,
      shortDescription: include("shortDescription") ? mp.shortDescription : null,
      imageUrl:         include("image")            ? imageUrl            : null,
      categoryId:       include("category") && pixelCategoryId ? pixelCategoryId : null,
      isActive: true,
    })
    .returning({ id: products.id, name: products.name, slug: products.slug });

  const platform = include("platform") ? mp.platform?.toUpperCase() ?? null : null;

  await db.insert(productVariants).values({
    productId:   product.id,
    name:        mp.name,
    sku:         include("sku")         ? mp.sku         : `${mp.sku}-${Date.now()}`,
    priceUsd:    include("retailPrice") ? mp.retailPrice : "0",
    b2bPriceUsd: include("b2bPrice")   ? mp.b2bPrice    : null,
    stockCount:  include("stock")       ? mp.stock       : 0,
    platform:    platform as never,
    isActive:    true,
  });

  const [mapping] = await db
    .insert(metenziProductMappings)
    .values({
      metenziProductId,
      metenziSku:  mp.sku,
      metenziName: mp.name,
      pixelProductId: product.id,
      lastSyncedAt: new Date(),
    })
    .returning();

  res.json({ success: true, pixelProduct: product, mappingId: mapping.id });
});

// ── GET /admin/metenzi/pixel-products-search ─────────────────────────────────
// Quick search for Pixel products to use in the mapping dropdown
router.get("/admin/metenzi/pixel-products-search", ...guard, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) { res.json([]); return; }

  const { ilike, or } = await import("drizzle-orm");

  const rows = await db
    .select({ id: products.id, name: products.name, slug: products.slug })
    .from(products)
    .where(
      or(
        ilike(products.name, `%${q}%`),
        ilike(products.slug, `%${q}%`),
      ),
    )
    .limit(20);

  res.json(rows);
});

export default router;
