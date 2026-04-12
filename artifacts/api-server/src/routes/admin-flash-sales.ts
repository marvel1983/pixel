import { Router } from "express";
import { db } from "@workspace/db";
import { flashSales, flashSaleProducts, products, productVariants } from "@workspace/db/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { z } from "zod";
import { paramString } from "../lib/route-params";

const router = Router();
const guard = [requireAuth, requireAdmin];

router.get("/admin/flash-sales", ...guard, async (_req, res) => {
  const rows = await db.select({
    id: flashSales.id,
    name: flashSales.name,
    slug: flashSales.slug,
    status: flashSales.status,
    isActive: flashSales.isActive,
    startsAt: flashSales.startsAt,
    endsAt: flashSales.endsAt,
    bannerText: flashSales.bannerText,
    bannerColor: flashSales.bannerColor,
    createdAt: flashSales.createdAt,
    productCount: sql<number>`(SELECT COUNT(*) FROM flash_sale_products WHERE flash_sale_id = ${flashSales.id})`.as("product_count"),
    totalSold: sql<number>`COALESCE((SELECT SUM(sold_count) FROM flash_sale_products WHERE flash_sale_id = ${flashSales.id}), 0)`.as("total_sold"),
  }).from(flashSales).orderBy(desc(flashSales.createdAt));

  res.json(rows);
});

router.get("/admin/flash-sales/:id", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [sale] = await db.select().from(flashSales).where(eq(flashSales.id, id));
  if (!sale) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select({
    id: flashSaleProducts.id,
    productId: flashSaleProducts.productId,
    variantId: flashSaleProducts.variantId,
    salePriceUsd: flashSaleProducts.salePriceUsd,
    maxQuantity: flashSaleProducts.maxQuantity,
    soldCount: flashSaleProducts.soldCount,
    sortOrder: flashSaleProducts.sortOrder,
    productName: products.name,
    variantName: productVariants.name,
    originalPriceUsd: productVariants.priceUsd,
    platform: productVariants.platform,
    productImage: products.imageUrl,
  })
    .from(flashSaleProducts)
    .innerJoin(products, eq(flashSaleProducts.productId, products.id))
    .innerJoin(productVariants, eq(flashSaleProducts.variantId, productVariants.id))
    .where(eq(flashSaleProducts.flashSaleId, id))
    .orderBy(flashSaleProducts.sortOrder);

  res.json({ ...sale, products: items });
});

const saleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ENDED"]).default("DRAFT"),
  startsAt: z.string(),
  endsAt: z.string(),
  bannerText: z.string().optional(),
  bannerColor: z.string().default("#ef4444"),
  isActive: z.boolean().default(true),
  products: z.array(z.object({
    productId: z.number(),
    variantId: z.number(),
    salePriceUsd: z.string(),
    maxQuantity: z.number().min(1).default(100),
    sortOrder: z.number().default(0),
  })).default([]),
});

router.post("/admin/flash-sales", ...guard, async (req, res) => {
  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data", details: parsed.error.format() }); return; }
  const { products: saleProducts, ...saleData } = parsed.data;

  const [sale] = await db.insert(flashSales).values({
    ...saleData,
    startsAt: new Date(saleData.startsAt),
    endsAt: new Date(saleData.endsAt),
  }).returning();

  if (saleProducts.length > 0) {
    await db.insert(flashSaleProducts).values(
      saleProducts.map((p) => ({ ...p, flashSaleId: sale.id }))
    );
  }

  res.json(sale);
});

router.put("/admin/flash-sales/:id", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = saleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { products: saleProducts, ...saleData } = parsed.data;

  const [sale] = await db.update(flashSales).set({
    ...saleData,
    startsAt: new Date(saleData.startsAt),
    endsAt: new Date(saleData.endsAt),
    updatedAt: new Date(),
  }).where(eq(flashSales.id, id)).returning();

  if (!sale) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(flashSaleProducts).where(eq(flashSaleProducts.flashSaleId, id));
  if (saleProducts.length > 0) {
    await db.insert(flashSaleProducts).values(
      saleProducts.map((p) => ({ ...p, flashSaleId: id }))
    );
  }

  res.json(sale);
});

router.delete("/admin/flash-sales/:id", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(flashSales).where(eq(flashSales.id, id));
  res.json({ success: true });
});

router.post("/admin/flash-sales/:id/duplicate", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [orig] = await db.select().from(flashSales).where(eq(flashSales.id, id));
  if (!orig) { res.status(404).json({ error: "Not found" }); return; }

  const [copy] = await db.insert(flashSales).values({
    name: `${orig.name} (Copy)`,
    slug: `${orig.slug}-copy-${Date.now()}`,
    description: orig.description,
    status: "DRAFT",
    startsAt: orig.startsAt,
    endsAt: orig.endsAt,
    bannerText: orig.bannerText,
    bannerColor: orig.bannerColor,
    isActive: false,
  }).returning();

  const items = await db.select().from(flashSaleProducts).where(eq(flashSaleProducts.flashSaleId, id));
  if (items.length > 0) {
    await db.insert(flashSaleProducts).values(
      items.map((i) => ({
        flashSaleId: copy.id,
        productId: i.productId,
        variantId: i.variantId,
        salePriceUsd: i.salePriceUsd,
        maxQuantity: i.maxQuantity,
        sortOrder: i.sortOrder,
      }))
    );
  }

  res.json(copy);
});

router.get("/admin/flash-sales/:id/analytics", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const items = await db.select({
    variantId: flashSaleProducts.variantId,
    productName: products.name,
    variantName: productVariants.name,
    salePriceUsd: flashSaleProducts.salePriceUsd,
    originalPriceUsd: productVariants.priceUsd,
    soldCount: flashSaleProducts.soldCount,
    maxQuantity: flashSaleProducts.maxQuantity,
  })
    .from(flashSaleProducts)
    .innerJoin(products, eq(flashSaleProducts.productId, products.id))
    .innerJoin(productVariants, eq(flashSaleProducts.variantId, productVariants.id))
    .where(eq(flashSaleProducts.flashSaleId, id));

  const enriched = items.map((i) => ({
    ...i,
    revenue: (i.soldCount * parseFloat(i.salePriceUsd)).toFixed(2),
  }));
  const totalSold = items.reduce((s, i) => s + i.soldCount, 0);
  const totalRevenue = items.reduce((s, i) => s + i.soldCount * parseFloat(i.salePriceUsd), 0);

  res.json({ items: enriched, totalSold, totalRevenue: totalRevenue.toFixed(2) });
});

export default router;
