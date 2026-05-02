import { Router } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { metenziProductMappings, products, productVariants } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getCatalogPage, getProducts, type MetenziProduct } from "../lib/metenzi-endpoints";
import { logger } from "../lib/logger";
import { metenziRequest } from "../lib/metenzi-client";

let _cachedAll: MetenziProduct[] | null = null;
let _cacheTs = 0;
const CATALOG_TTL = 5 * 60 * 1000;

async function getAllProducts(config: Parameters<typeof getProducts>[0]): Promise<MetenziProduct[]> {
  const now = Date.now();
  if (_cachedAll && now - _cacheTs < CATALOG_TTL) return _cachedAll;
  _cachedAll = await getProducts(config);
  _cacheTs = now;
  return _cachedAll;
}

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

router.get("/admin/metenzi/debug", ...guard, async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Not configured", baseUrl: null }); return; }
  const rawRes = await metenziRequest(config, { method: "GET", path: "/api/public/products", query: { limit: "3", offset: "0" } });
  res.json({ baseUrl: config.baseUrl, ok: rawRes.ok, status: rawRes.status, data: rawRes.data });
});

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

router.get("/admin/metenzi/catalog", ...guard, async (req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Metenzi not configured" }); return; }

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    // 100000 is the "All" sentinel from the admin UI; cap real paging at 1000.
    const rawLimit = parseInt(req.query.limit as string) || 50;
    const wantsAll = rawLimit >= 10000;
    const limit = wantsAll ? Number.MAX_SAFE_INTEGER : Math.min(1000, Math.max(5, rawLimit));
    const search = (req.query.search as string | undefined)?.trim().toLowerCase();
    const category = req.query.category as string | undefined;
    const platform = req.query.platform as string | undefined;

    let pageProducts: MetenziProduct[];
    let total: number;

    if (search || category || platform || wantsAll) {
      let all = await getAllProducts(config);
      if (search) all = all.filter((p) => p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search));
      if (category) all = all.filter((p) => p.category === category);
      if (platform) all = all.filter((p) => p.platform === platform);
      total = all.length;
      pageProducts = wantsAll ? all : all.slice((page - 1) * limit, page * limit);
    } else {
      const catalog = await getCatalogPage(config, { page, limit });
      pageProducts = catalog.products;
      total = catalog.total;
    }

    const metenziIds = pageProducts.map((p) => p.id);
    const mappings = metenziIds.length
      ? await db
          .select({ metenziProductId: metenziProductMappings.metenziProductId, pixelProductId: metenziProductMappings.pixelProductId, mappingId: metenziProductMappings.id, autoSyncStock: metenziProductMappings.autoSyncStock })
          .from(metenziProductMappings)
          .where(and(
            inArray(metenziProductMappings.metenziProductId, metenziIds),
            eq(metenziProductMappings.disabled, false),
          ))
      : [];

    const mappingMap = new Map(mappings.map((m) => [m.metenziProductId, m]));
    const mappedPixelIds = mappings.map((m) => m.pixelProductId).filter((id): id is number => id !== null);
    const pixelProducts = mappedPixelIds.length
      ? await db.select({ id: products.id, name: products.name, slug: products.slug }).from(products).where(inArray(products.id, mappedPixelIds))
      : [];
    const pixelMap = new Map(pixelProducts.map((p) => [p.id, p]));

    const enriched = pageProducts.map((mp) => {
      const mapping = mappingMap.get(mp.id);
      const pixel = mapping?.pixelProductId ? pixelMap.get(mapping.pixelProductId) : null;
      return { ...mp, mapped: !!mapping, mappingId: mapping?.mappingId ?? null, autoSyncStock: mapping?.autoSyncStock ?? false, pixelProduct: pixel ?? null };
    });

    res.json({ products: enriched, total, page, limit });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Metenzi catalog");
    res.status(500).json({ error: "Failed to fetch catalog" });
  }
});

router.get("/admin/metenzi/catalog/meta", ...guard, async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.json({ categories: [], platforms: [] }); return; }
  try {
    const catalog = await getCatalogPage(config, { limit: 50, page: 1 });
    const categories = [...new Set(catalog.products.map((p) => p.category).filter(Boolean))].sort();
    const platforms = [...new Set(catalog.products.map((p) => p.platform).filter(Boolean))].sort();
    res.json({ categories, platforms });
  } catch {
    res.json({ categories: [], platforms: [] });
  }
});

router.get("/admin/metenzi/pixel-products-search", ...guard, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) { res.json([]); return; }
  const { ilike, or } = await import("drizzle-orm");
  const rows = await db
    .select({ id: products.id, name: products.name, slug: products.slug })
    .from(products)
    .where(or(ilike(products.name, `%${q}%`), ilike(products.slug, `%${q}%`)))
    .limit(20);
  res.json(rows);
});

router.post("/admin/metenzi/enable-backorder", ...guard, async (_req, res) => {
  const result = await db.update(productVariants).set({ backorderAllowed: true }).where(eq(productVariants.isActive, true));
  res.json({ success: true, updated: result.rowCount ?? 0 });
});

export default router;
