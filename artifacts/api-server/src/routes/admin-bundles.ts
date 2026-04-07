import { Router } from "express";
import { db } from "@workspace/db";
import { bundles, bundleItems, products, productVariants, orderItems } from "@workspace/db/schema";
import { eq, asc, ilike, sql, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { z } from "zod/v4";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageProducts")];

const bundleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  imageUrl: z.string().optional(),
  bundlePriceUsd: z.string(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  sortOrder: z.number().optional(),
  productIds: z.array(z.number()).min(2),
});

router.get("/admin/bundles", ...auth, async (req, res) => {
  const search = (req.query.search as string) || "";
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const where = search ? ilike(bundles.name, `%${search}%`) : undefined;

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(bundles).where(where)
      .orderBy(asc(bundles.sortOrder), desc(bundles.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(bundles).where(where),
  ]);

  const result = await Promise.all(
    rows.map(async (b) => {
      const items = await db
        .select({
          productId: bundleItems.productId,
          productName: products.name,
          productImage: products.imageUrl,
          sortOrder: bundleItems.sortOrder,
        })
        .from(bundleItems)
        .innerJoin(products, eq(bundleItems.productId, products.id))
        .where(eq(bundleItems.bundleId, b.id))
        .orderBy(asc(bundleItems.sortOrder));
      return { ...b, items };
    }),
  );

  res.json({ bundles: result, total: count, page, pages: Math.ceil(count / limit) });
});

router.get("/admin/bundles/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!bundle) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db
    .select({
      productId: bundleItems.productId,
      productName: products.name,
      productImage: products.imageUrl,
      sortOrder: bundleItems.sortOrder,
    })
    .from(bundleItems)
    .innerJoin(products, eq(bundleItems.productId, products.id))
    .where(eq(bundleItems.bundleId, id))
    .orderBy(asc(bundleItems.sortOrder));

  res.json({ ...bundle, productIds: items.map((i) => i.productId), items });
});

router.post("/admin/bundles", ...auth, async (req, res) => {
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { productIds, ...data } = parsed.data;

  const [bundle] = await db.insert(bundles).values({
    ...data,
    bundlePriceUsd: data.bundlePriceUsd,
  }).returning();

  await db.insert(bundleItems).values(
    productIds.map((pid, i) => ({ bundleId: bundle.id, productId: pid, sortOrder: i })),
  );

  res.json(bundle);
});

router.put("/admin/bundles/:id", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { productIds, ...data } = parsed.data;

  const [updated] = await db.update(bundles).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(bundles.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(bundleItems).where(eq(bundleItems.bundleId, id));
  await db.insert(bundleItems).values(
    productIds.map((pid, i) => ({ bundleId: id, productId: pid, sortOrder: i })),
  );

  res.json(updated);
});

router.delete("/admin/bundles/:id", ...auth, async (req, res) => {
  await db.delete(bundles).where(eq(bundles.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

router.post("/admin/bundles/:id/duplicate", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [original] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!original) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));

  const [copy] = await db.insert(bundles).values({
    name: `${original.name} (Copy)`,
    slug: `${original.slug}-copy-${Date.now()}`,
    description: original.description,
    shortDescription: original.shortDescription,
    imageUrl: original.imageUrl,
    bundlePriceUsd: original.bundlePriceUsd,
    isActive: false,
    isFeatured: false,
    metaTitle: original.metaTitle,
    metaDescription: original.metaDescription,
    sortOrder: original.sortOrder,
  }).returning();

  if (items.length) {
    await db.insert(bundleItems).values(
      items.map((i) => ({ bundleId: copy.id, productId: i.productId, sortOrder: i.sortOrder })),
    );
  }

  res.json(copy);
});

router.get("/admin/bundles/:id/analytics", ...auth, async (req, res) => {
  const id = parseInt(req.params.id);
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!bundle) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select({ productId: bundleItems.productId })
    .from(bundleItems).where(eq(bundleItems.bundleId, id));
  const productIds = items.map((i) => i.productId);

  let purchases = 0;
  let revenue = 0;
  if (productIds.length > 0) {
    const variantIds = await db.select({ id: productVariants.id })
      .from(productVariants).where(inArray(productVariants.productId, productIds));
    if (variantIds.length > 0) {
      const vIds = variantIds.map((v) => v.id);
      const stats = await db.select({
        count: sql<number>`count(distinct ${orderItems.orderId})`,
        total: sql<string>`coalesce(sum(${orderItems.priceUsd} * ${orderItems.quantity}), 0)`,
      }).from(orderItems).where(inArray(orderItems.variantId, vIds));
      purchases = Number(stats[0]?.count ?? 0);
      revenue = parseFloat(stats[0]?.total ?? "0");
    }
  }

  res.json({ bundleId: id, name: bundle.name, itemCount: productIds.length, purchases, revenue: revenue.toFixed(2) });
});

export default router;
