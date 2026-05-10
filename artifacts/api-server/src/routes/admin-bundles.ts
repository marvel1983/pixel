import { Router } from "express";
import { db } from "@workspace/db";
import { bundles, bundleItems, products, productVariants, orderItems } from "@workspace/db/schema";
import { eq, asc, ilike, sql, and, desc, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { z } from "zod/v4";
import { paramString } from "../lib/route-params";
import { computeBundlePrice, type BundleComponentInput, type BundleDiscountType } from "../services/bundle-pricing";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageProducts")];

const nullishStr = z.string().nullish().transform((v) => v ?? null);

const bundleSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: nullishStr,
  shortDescription: nullishStr,
  imageUrl: nullishStr,
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: nullishStr,
  metaDescription: nullishStr,
  sortOrder: z.number().optional(),
  productIds: z.array(z.number()).min(2),
  primaryProductId: z.number().int().positive(),
  discountType: z.enum(["PERCENTAGE", "FIXED", "BUY_X_GET_Y_FREE"]),
  discountValue: z.string().default("0"),
  minPrimaryQty: z.number().int().min(1).default(1),
});

type BundleFormData = z.infer<typeof bundleSchema>;

function validateRule(d: BundleFormData): string | null {
  if (!d.productIds.includes(d.primaryProductId)) {
    return "Primary product must be included in productIds";
  }
  const v = Number(d.discountValue);
  if (!Number.isFinite(v) || v < 0) return "discountValue must be non-negative";
  if (d.discountType === "PERCENTAGE" && v > 100) return "Percentage discount must be 0–100";
  return null;
}

async function pricePreviewFor(productIds: number[], primaryProductId: number, rule: { discountType: BundleDiscountType; discountValue: string; minPrimaryQty: number }) {
  const variants = await db.select({
    productId: productVariants.productId,
    priceUsd: productVariants.priceUsd,
  })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)));

  const minByProduct = new Map<number, string>();
  for (const v of variants) {
    const cur = minByProduct.get(v.productId);
    if (cur === undefined || Number(v.priceUsd) < Number(cur)) minByProduct.set(v.productId, v.priceUsd);
  }

  const components: BundleComponentInput[] = productIds.map((pid) => ({
    productId: pid,
    unitPriceUsd: minByProduct.get(pid) ?? "0",
    isPrimary: pid === primaryProductId,
  }));

  return computeBundlePrice(components, rule);
}

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
  const id = parseInt(paramString(req.params, "id"));
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

router.post("/admin/bundles/preview", ...auth, async (req, res) => {
  const parsed = bundleSchema.pick({ productIds: true, primaryProductId: true, discountType: true, discountValue: true, minPrimaryQty: true }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  if (!d.productIds.includes(d.primaryProductId)) { res.status(400).json({ error: "Primary product must be in productIds" }); return; }
  const pricing = await pricePreviewFor(d.productIds, d.primaryProductId, { discountType: d.discountType, discountValue: d.discountValue, minPrimaryQty: d.minPrimaryQty });
  res.json(pricing);
});

router.post("/admin/bundles", ...auth, async (req, res) => {
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const ruleError = validateRule(data);
  if (ruleError) { res.status(400).json({ error: ruleError }); return; }

  const pricing = await pricePreviewFor(data.productIds, data.primaryProductId, {
    discountType: data.discountType, discountValue: data.discountValue, minPrimaryQty: data.minPrimaryQty,
  });

  const { productIds, primaryProductId, discountType, discountValue, minPrimaryQty, ...rest } = data;

  const [bundle] = await db.insert(bundles).values({
    ...rest,
    primaryProductId, discountType, discountValue, minPrimaryQty,
    bundlePriceUsd: pricing.finalUsd,
  }).returning();

  await db.insert(bundleItems).values(
    productIds.map((pid, i) => ({
      bundleId: bundle.id,
      productId: pid,
      sortOrder: pid === primaryProductId ? 0 : i + 1,
    })),
  );

  res.json({ ...bundle, pricing });
});

router.put("/admin/bundles/:id", ...auth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const ruleError = validateRule(data);
  if (ruleError) { res.status(400).json({ error: ruleError }); return; }

  const pricing = await pricePreviewFor(data.productIds, data.primaryProductId, {
    discountType: data.discountType, discountValue: data.discountValue, minPrimaryQty: data.minPrimaryQty,
  });

  const { productIds, primaryProductId, discountType, discountValue, minPrimaryQty, ...rest } = data;

  const [updated] = await db.update(bundles).set({
    ...rest,
    primaryProductId, discountType, discountValue, minPrimaryQty,
    bundlePriceUsd: pricing.finalUsd,
    updatedAt: new Date(),
  }).where(eq(bundles.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(bundleItems).where(eq(bundleItems.bundleId, id));
  await db.insert(bundleItems).values(
    productIds.map((pid, i) => ({
      bundleId: id,
      productId: pid,
      sortOrder: pid === primaryProductId ? 0 : i + 1,
    })),
  );

  res.json({ ...updated, pricing });
});

router.delete("/admin/bundles/:id", ...auth, async (req, res) => {
  await db.delete(bundles).where(eq(bundles.id, parseInt(paramString(req.params, "id"))));
  res.json({ ok: true });
});

router.post("/admin/bundles/:id/duplicate", ...auth, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
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
    primaryProductId: original.primaryProductId,
    discountType: original.discountType,
    discountValue: original.discountValue,
    minPrimaryQty: original.minPrimaryQty,
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
  const id = parseInt(paramString(req.params, "id"));
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!bundle) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db.select({ productId: bundleItems.productId })
    .from(bundleItems).where(eq(bundleItems.bundleId, id));

  const stats = await db.select({
    count: sql<number>`count(distinct ${orderItems.orderId})`,
    total: sql<string>`coalesce(sum(${orderItems.priceUsd} * ${orderItems.quantity}), 0)`,
  }).from(orderItems).where(eq(orderItems.bundleId, id));

  const purchases = Number(stats[0]?.count ?? 0);
  const revenue = parseFloat(stats[0]?.total ?? "0");

  res.json({ bundleId: id, name: bundle.name, itemCount: items.length, purchases, revenue: revenue.toFixed(2) });
});

export default router;
