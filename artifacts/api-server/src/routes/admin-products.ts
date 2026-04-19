import { Router } from "express";
import { db } from "@workspace/db";
import { products, productVariants, categories } from "@workspace/db/schema";
import { eq, sql, and, ilike, count, asc, desc, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { syncProducts } from "../lib/product-sync";
import { getMetenziConfig } from "../lib/metenzi-config";
import { paramString } from "../lib/route-params";

const router = Router();

router.get("/admin/products", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 25;
  const offset = (page - 1) * limit;
  const q = (req.query.q as string) ?? "";
  const cat = (req.query.cat as string) ?? "";
  const status = (req.query.status as string) ?? "";
  const platform = (req.query.platform as string) ?? "";

  const conditions = [];
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      sql`(${products.name} ILIKE ${pattern} OR EXISTS (
        SELECT 1 FROM product_variants pv WHERE pv.product_id = ${products.id} AND pv.sku ILIKE ${pattern}
      ))`,
    );
  }
  if (cat) conditions.push(eq(products.categoryId, Number(cat)));
  if (status === "active") conditions.push(eq(products.isActive, true));
  if (status === "inactive") conditions.push(eq(products.isActive, false));
  if (platform) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = ${products.id} AND pv.platform = ${platform})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(where);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      categoryId: products.categoryId,
      categoryName: categories.name,
      isFeatured: products.isFeatured,
      isActive: products.isActive,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(where)
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);

  const productIds = rows.map((r) => r.id);
  const variantMap: Record<number, { sku: string; priceUsd: string; stockCount: number; platform: string | null }[]> = {};
  if (productIds.length > 0) {
    const variants = await db
      .select({
        productId: productVariants.productId,
        sku: productVariants.sku,
        priceUsd: productVariants.priceUsd,
        stockCount: productVariants.stockCount,
        platform: productVariants.platform,
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds));
    for (const v of variants) {
      if (!variantMap[v.productId]) variantMap[v.productId] = [];
      variantMap[v.productId].push(v);
    }
  }

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));

  const platforms = ["WINDOWS", "MAC", "LINUX", "STEAM", "ORIGIN", "UPLAY", "GOG", "EPIC", "XBOX", "PLAYSTATION", "NINTENDO", "OTHER"];

  res.json({
    products: rows.map((r) => ({
      ...r,
      variants: variantMap[r.id] ?? [],
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    categories: cats,
    platforms,
  });
});

router.post("/admin/products/bulk", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const { ids, action } = req.body as { ids: number[]; action: string };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "No product IDs provided" });
    return;
  }
  if (action === "activate") {
    await db.update(products).set({ isActive: true, updatedAt: new Date() }).where(inArray(products.id, ids));
  } else if (action === "deactivate") {
    await db.update(products).set({ isActive: false, updatedAt: new Date() }).where(inArray(products.id, ids));
  } else {
    res.status(400).json({ error: "Invalid action" });
    return;
  }
  res.json({ success: true, affected: ids.length });
});

router.post("/admin/products/sync", requireAuth, requireAdmin, requirePermission("manageProducts"), async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) {
    res.status(400).json({ error: "Metenzi not configured" });
    return;
  }
  try {
    const result = await syncProducts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Sync failed" });
  }
});

router.get("/admin/products/export", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const idsParam = (req.query.ids as string) ?? "";
  const filterIds = idsParam ? idsParam.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];

  const baseQuery = db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      category: categories.name,
      isActive: products.isActive,
      isFeatured: products.isFeatured,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(asc(products.name));

  const rows = filterIds.length > 0
    ? await baseQuery.where(inArray(products.id, filterIds))
    : await baseQuery;

  const variants = await db
    .select()
    .from(productVariants)
    .orderBy(asc(productVariants.productId));

  const varMap: Record<number, typeof variants> = {};
  for (const v of variants) {
    if (!varMap[v.productId]) varMap[v.productId] = [];
    varMap[v.productId].push(v);
  }

  const header = "ID,Name,Slug,Category,Active,Featured,SKU,Platform,Price,Stock\n";
  const csvRows = rows.flatMap((p) => {
    const pvs = varMap[p.id] ?? [{ sku: "", platform: "", priceUsd: "", stockCount: 0 }];
    return pvs.map((v) =>
      [p.id, `"${p.name}"`, p.slug, p.category ?? "", p.isActive, p.isFeatured, v.sku, v.platform ?? "", v.priceUsd, v.stockCount].join(","),
    );
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=products.csv");
  res.send(header + csvRows.join("\n"));
});

router.get("/admin/products/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id));

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))
    .orderBy(asc(productVariants.sortOrder));

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));

  const allProducts = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(sql`${products.id} != ${id}`)
    .orderBy(asc(products.name));

  res.json({ product, variants, categories: cats, allProducts });
});

router.post("/admin/products", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const body = req.body;
  if (!body.name?.trim()) {
    res.status(400).json({ error: "Product name is required" });
    return;
  }

  // Generate slug from name if not provided
  const slug = body.slug?.trim() ||
    body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Check slug uniqueness
  const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
  if (existing) {
    res.status(409).json({ error: "A product with this slug already exists" });
    return;
  }

  const [created] = await db
    .insert(products)
    .values({
      name: body.name.trim(),
      slug,
      shortDescription: body.shortDescription || null,
      description: body.description || null,
      type: body.type || "SOFTWARE",
      categoryId: body.categoryId || null,
      imageUrl: body.imageUrl || null,
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
      isFeatured: body.isFeatured ?? false,
      isActive: body.isActive ?? false,
      keyFeatures: body.keyFeatures ?? [],
      systemRequirements: body.systemRequirements ?? {},
      relatedProductIds: body.relatedProductIds ?? [],
      crossSellProductIds: body.crossSellProductIds ?? [],
      regionRestrictions: body.regionRestrictions ?? [],
      platformType: body.platformType || null,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning({ id: products.id });

  res.status(201).json({ id: created.id });
});

router.put("/admin/products/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }

  const body = req.body;
  await db
    .update(products)
    .set({
      name: body.name,
      slug: body.slug,
      shortDescription: body.shortDescription,
      description: body.description,
      type: body.type,
      categoryId: body.categoryId || null,
      imageUrl: body.imageUrl,
      metaTitle: body.metaTitle,
      metaDescription: body.metaDescription,
      isFeatured: body.isFeatured,
      isActive: body.isActive,
      keyFeatures: body.keyFeatures ?? [],
      systemRequirements: body.systemRequirements ?? {},
      relatedProductIds: body.relatedProductIds ?? [],
      crossSellProductIds: body.crossSellProductIds ?? [],
      regionRestrictions: body.regionRestrictions ?? [],
      platformType: body.platformType || null,
      sortOrder: body.sortOrder,
      activationInstructions: body.activationInstructions ?? null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id));

  res.json({ success: true });
});

router.patch("/admin/products/:id/toggle", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid product ID" });
    return;
  }
  const [product] = await db
    .select({ isActive: products.isActive })
    .from(products)
    .where(eq(products.id, id));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await db
    .update(products)
    .set({ isActive: !product.isActive, updatedAt: new Date() })
    .where(eq(products.id, id));
  res.json({ isActive: !product.isActive });
});

router.post("/admin/products/:id/variants", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const productId = Number(paramString(req.params, "id"));
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: "Invalid product ID" }); return;
  }
  const { name, sku, priceUsd, compareAtPriceUsd, costPriceUsd, b2bPriceUsd, stockCount, platform } = req.body;
  if (!name?.trim() || !sku?.trim() || !priceUsd) {
    res.status(400).json({ error: "name, sku, and priceUsd are required" }); return;
  }
  const [existing] = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, sku.trim()));
  if (existing) { res.status(409).json({ error: "SKU already exists" }); return; }
  const [created] = await db.insert(productVariants).values({
    productId,
    name: name.trim(),
    sku: sku.trim().toUpperCase(),
    priceUsd: String(priceUsd),
    compareAtPriceUsd: compareAtPriceUsd ? String(compareAtPriceUsd) : null,
    costPriceUsd: costPriceUsd ? String(costPriceUsd) : null,
    b2bPriceUsd: b2bPriceUsd ? String(b2bPriceUsd) : null,
    stockCount: stockCount ?? 0,
    platform: platform || null,
    isActive: true,
  }).returning();
  res.status(201).json({ variant: created });
});

router.patch("/admin/variants/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid variant ID" }); return; }
  const { name, sku, priceUsd, compareAtPriceUsd, priceOverrideUsd, costPriceUsd, b2bPriceUsd, stockCount, isActive } = req.body;
  await db.update(productVariants).set({
    ...(name !== undefined && { name }),
    ...(sku !== undefined && { sku: sku.toUpperCase() }),
    ...(priceUsd !== undefined && { priceUsd: String(priceUsd) }),
    ...(compareAtPriceUsd !== undefined && { compareAtPriceUsd: compareAtPriceUsd ? String(compareAtPriceUsd) : null }),
    ...(priceOverrideUsd !== undefined && { priceOverrideUsd: priceOverrideUsd ? String(priceOverrideUsd) : null }),
    ...(costPriceUsd !== undefined && { costPriceUsd: costPriceUsd ? String(costPriceUsd) : null }),
    ...(b2bPriceUsd !== undefined && { b2bPriceUsd: b2bPriceUsd ? String(b2bPriceUsd) : null }),
    ...(stockCount !== undefined && { stockCount }),
    ...(isActive !== undefined && { isActive }),
    updatedAt: new Date(),
  }).where(eq(productVariants.id, id));
  res.json({ success: true });
});

router.delete("/admin/variants/:id", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid variant ID" }); return; }
  await db.delete(productVariants).where(eq(productVariants.id, id));
  res.json({ success: true });
});

router.patch("/admin/variants/:id/price-override", requireAuth, requireAdmin, requirePermission("manageProducts"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid variant ID" });
    return;
  }
  const { priceOverrideUsd } = req.body as { priceOverrideUsd: string | null };
  await db
    .update(productVariants)
    .set({ priceOverrideUsd: priceOverrideUsd || null, updatedAt: new Date() })
    .where(eq(productVariants.id, id));
  res.json({ success: true });
});

export default router;
