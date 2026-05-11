import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  metenziProductMappings, products, productVariants,
  tags, productTags, attributeDefinitions, attributeOptions, productAttributes,
} from "@workspace/db/schema";
import { triggerFeedRefresh } from "../services/feed-scheduler";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getCatalogPage, getProductById, type MetenziProduct } from "../lib/metenzi-endpoints";
import { downloadImageToVps } from "../lib/image-downloader";
import { logger } from "../lib/logger";

function stripNulls(s: string | null | undefined): string | null {
  if (!s) return null;
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim() || null;
}

function sanitizeText(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\x00/g, "")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() || null;
}

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

const syncFieldSchema = z.object({
  mappingId: z.number().int().positive(),
  fields: z.array(z.enum(["name", "image", "b2bPrice", "retailPrice", "description", "shortDescription", "sku", "stock", "instructions", "tags", "attributes"])),
});

router.post("/admin/metenzi/sync-field", ...guard, async (req, res) => {
  const parsed = syncFieldSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { mappingId, fields } = parsed.data;

  const [mapping] = await db.select().from(metenziProductMappings).where(eq(metenziProductMappings.id, mappingId)).limit(1);
  if (!mapping || !mapping.pixelProductId) { res.status(404).json({ error: "Mapping not found or no Pixel product linked" }); return; }

  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Metenzi not configured" }); return; }

  let mp: MetenziProduct | null = null;
  if (fields.includes("instructions")) {
    mp = await getProductById(config, mapping.metenziProductId);
  } else {
    const catRes = await getCatalogPage(config, { search: mapping.metenziSku ?? mapping.metenziProductId, limit: 5 });
    mp = catRes.products.find((p) => p.id === mapping.metenziProductId) ?? null;
  }
  if (!mp) { res.status(404).json({ error: "Product not found in Metenzi" }); return; }

  const [variant] = await db.select().from(productVariants).where(eq(productVariants.productId, mapping.pixelProductId)).limit(1);

  const synced: string[] = [];
  const productCols: { name?: string; description?: string; shortDescription?: string; imageUrl?: string; activationInstructions?: string | null; updatedAt?: Date } = {};
  const variantCols: { sku?: string; priceUsd?: string; b2bPriceUsd?: string; stockCount?: number; updatedAt?: Date } = {};

  for (const field of fields) {
    switch (field) {
      case "name": productCols.name = mp.name; synced.push("name"); break;
      case "description": productCols.description = stripNulls(mp.description) ?? undefined; synced.push("description"); break;
      case "shortDescription": productCols.shortDescription = stripNulls(mp.shortDescription) ?? undefined; synced.push("shortDescription"); break;
      case "b2bPrice": variantCols.b2bPriceUsd = mp.b2bPrice; synced.push("b2bPrice"); break;
      case "retailPrice": variantCols.priceUsd = mp.retailPrice; synced.push("retailPrice"); break;
      case "sku": variantCols.sku = mp.sku; synced.push("sku"); break;
      case "stock": variantCols.stockCount = mp.stock; synced.push("stock"); break;
      case "instructions": productCols.activationInstructions = sanitizeText(mp.instructions); synced.push("instructions"); break;
      case "tags":
      case "attributes":
        break;
      case "image":
        if (!mp.imageUrl) { res.status(422).json({ error: "Metenzi product has no imageUrl" }); return; }
        try {
          productCols.imageUrl = await downloadImageToVps(mp.imageUrl);
          synced.push("image");
        } catch (err) {
          logger.warn({ err, imageUrl: mp.imageUrl }, "Image sync failed");
          res.status(500).json({ error: `Image download failed: ${(err as Error).message}` });
          return;
        }
        break;
    }
  }

  if (Object.keys(productCols).length > 0) {
    await db.update(products).set({ ...productCols, updatedAt: new Date() }).where(eq(products.id, mapping.pixelProductId));
  }
  if (variant && Object.keys(variantCols).length > 0) {
    await db.update(productVariants).set({ ...variantCols, updatedAt: new Date() }).where(eq(productVariants.id, variant.id));
  }
  if (fields.includes("tags") || fields.includes("attributes")) {
    try { await syncTagsAndAttributes(mapping.pixelProductId!, mp); synced.push(...fields.filter((f) => f === "tags" || f === "attributes")); }
    catch (err) { logger.warn({ err }, "Tags/attributes sync failed in sync-field"); }
  }

  await db.update(metenziProductMappings).set({ lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(metenziProductMappings.id, mappingId));
  if (Object.keys(variantCols).length > 0) triggerFeedRefresh();
  res.json({ success: true, synced });
});

async function syncTagsAndAttributes(pixelProductId: number, mp: MetenziProduct): Promise<void> {
  if (mp.tags?.length) {
    for (const t of mp.tags) {
      const slug = t.slug || t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [tag] = await db.insert(tags).values({ name: t.name, slug, colorHex: t.color ?? "#3b82f6" })
        .onConflictDoUpdate({ target: tags.slug, set: { name: t.name } }).returning({ id: tags.id });
      await db.insert(productTags).values({ productId: pixelProductId, tagId: tag.id }).onConflictDoNothing();
    }
  }
  if (mp.attributes?.length) {
    for (const attr of mp.attributes) {
      const defSlug = attr.attributeSlug || attr.attributeName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const [def] = await db.insert(attributeDefinitions).values({ name: attr.attributeName, slug: defSlug })
        .onConflictDoUpdate({ target: attributeDefinitions.slug, set: { name: attr.attributeName } }).returning({ id: attributeDefinitions.id });
      const optSlug = attr.slug || attr.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const [opt] = await db.insert(attributeOptions).values({ attributeId: def.id, value: attr.name, slug: optSlug, colorHex: attr.color ?? null })
        .onConflictDoUpdate({ target: [attributeOptions.attributeId, attributeOptions.slug], set: { value: attr.name } }).returning({ id: attributeOptions.id });
      await db.insert(productAttributes).values({ productId: pixelProductId, attributeId: def.id, optionId: opt.id })
        .onConflictDoUpdate({ target: [productAttributes.productId, productAttributes.attributeId], set: { optionId: opt.id, updatedAt: new Date() } });
    }
  }
}

const importSchema = z.object({
  metenziProductId: z.string().min(1),
  fields: z.array(z.enum(["name", "image", "b2bPrice", "retailPrice", "description", "shortDescription", "sku", "stock", "category", "platform", "instructions", "tags", "attributes"])),
  pixelCategoryId: z.number().int().positive().optional(),
});

router.post("/admin/metenzi/import", ...guard, async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { metenziProductId, fields, pixelCategoryId } = parsed.data;

  const [existing] = await db.select({ id: metenziProductMappings.id }).from(metenziProductMappings)
    .where(eq(metenziProductMappings.metenziProductId, metenziProductId)).limit(1);
  if (existing) { res.status(409).json({ error: "Product already mapped" }); return; }

  const config = await getMetenziConfig();
  if (!config) { res.status(503).json({ error: "Metenzi not configured" }); return; }

  let mp: MetenziProduct | undefined;
  try {
    const result = await getProductById(config, metenziProductId);
    if (!result) { res.status(404).json({ error: "Metenzi product not found" }); return; }
    mp = result;
  } catch (err) {
    logger.error({ err, metenziProductId }, "Failed to fetch product from Metenzi");
    res.status(502).json({ error: "Failed to fetch product from Metenzi — try again shortly" }); return;
  }

  const f = new Set<string>(fields);
  const include = (field: string) => f.has(field);

  let imageUrl: string | null = null;
  if (include("image") && mp.imageUrl) {
    try { imageUrl = await downloadImageToVps(mp.imageUrl); }
    catch (err) { logger.warn({ err, imageSource: mp.imageUrl }, "Image download failed during import"); }
  }

  const baseSlug = (include("name") ? mp.name : mp.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const [existing2] = await db.select({ slug: products.slug }).from(products).where(eq(products.slug, baseSlug)).limit(1);
  const slug = existing2 ? `${baseSlug}-${Date.now()}` : baseSlug;

  const [product] = await db.insert(products).values({
    name: include("name") ? mp.name : mp.id, slug,
    description: include("description") ? stripNulls(mp.description) : null,
    shortDescription: include("shortDescription") ? stripNulls(mp.shortDescription) : null,
    imageUrl: include("image") ? imageUrl : null,
    activationInstructions: include("instructions") ? sanitizeText(mp.instructions) : null,
    categoryId: include("category") && pixelCategoryId ? pixelCategoryId : null,
    isActive: true,
  }).returning({ id: products.id, name: products.name, slug: products.slug });

  const platform = include("platform") ? mp.platform?.toUpperCase() ?? null : null;
  await db.insert(productVariants).values({
    productId: product.id, name: mp.name,
    sku: include("sku") ? mp.sku : `${mp.sku}-${Date.now()}`,
    priceUsd: include("retailPrice") ? mp.retailPrice : "0",
    b2bPriceUsd: include("b2bPrice") ? mp.b2bPrice : null,
    stockCount: include("stock") ? mp.stock : 0,
    platform: platform as never, isActive: true,
  });

  if (include("tags") || include("attributes")) {
    try { await syncTagsAndAttributes(product.id, mp); }
    catch (err) { logger.warn({ err, productId: product.id }, "Tags/attributes sync failed — product still imported"); }
  }

  const [mapping] = await db.insert(metenziProductMappings).values({
    metenziProductId, metenziSku: mp.sku, metenziName: mp.name,
    pixelProductId: product.id, lastSyncedAt: new Date(),
  }).returning();

  res.json({ success: true, pixelProduct: product, mappingId: mapping.id });

  // Regenerate all active feeds so new product URLs appear immediately
  triggerFeedRefresh();
});

export default router;
