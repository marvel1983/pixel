import { Router } from "express";
import { db } from "@workspace/db";
import { checkoutUpsell, products, productVariants } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/checkout-upsell", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: checkoutUpsell.id,
      productId: checkoutUpsell.productId,
      isActive: checkoutUpsell.isActive,
      displayPrice: checkoutUpsell.displayPrice,
      strikethroughPrice: checkoutUpsell.strikethroughPrice,
      urgencyMessage: checkoutUpsell.urgencyMessage,
      checkboxLabel: checkoutUpsell.checkboxLabel,
      createdAt: checkoutUpsell.createdAt,
      productName: products.name,
      productSlug: products.slug,
      productImage: products.imageUrl,
    })
    .from(checkoutUpsell)
    .innerJoin(products, eq(checkoutUpsell.productId, products.id))
    .orderBy(desc(checkoutUpsell.updatedAt));

  const active = rows.find((r) => r.isActive) ?? null;
  const history = rows.filter((r) => !r.isActive).slice(0, 3);
  res.json({ active, history });
});

router.post("/admin/checkout-upsell", requireAuth, requireAdmin, async (req, res) => {
  const { productId, displayPrice, strikethroughPrice, urgencyMessage, checkboxLabel } = req.body;
  if (!productId || typeof productId !== "number") {
    res.status(400).json({ error: "productId is required" });
    return;
  }

  await db.update(checkoutUpsell).set({ isActive: false, updatedAt: new Date() });

  const existing = await db.select().from(checkoutUpsell).where(eq(checkoutUpsell.productId, productId));
  if (existing.length > 0) {
    await db.update(checkoutUpsell).set({
      isActive: true, displayPrice: displayPrice ?? null, strikethroughPrice: strikethroughPrice ?? null,
      urgencyMessage: urgencyMessage ?? null, checkboxLabel: checkboxLabel ?? null, updatedAt: new Date(),
    }).where(eq(checkoutUpsell.productId, productId));
  } else {
    await db.insert(checkoutUpsell).values({
      productId, isActive: true, displayPrice: displayPrice ?? null,
      strikethroughPrice: strikethroughPrice ?? null, urgencyMessage: urgencyMessage ?? null,
      checkboxLabel: checkboxLabel ?? null,
    });
  }
  res.json({ success: true });
});

router.patch("/admin/checkout-upsell/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select({ isActive: checkoutUpsell.isActive }).from(checkoutUpsell).where(eq(checkoutUpsell.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  if (!row.isActive) {
    await db.update(checkoutUpsell).set({ isActive: false, updatedAt: new Date() });
  }
  await db.update(checkoutUpsell).set({ isActive: !row.isActive, updatedAt: new Date() }).where(eq(checkoutUpsell.id, id));
  res.json({ success: true, isActive: !row.isActive });
});

router.get("/checkout/upsell", async (_req, res) => {
  const [row] = await db
    .select({
      productId: checkoutUpsell.productId,
      displayPrice: checkoutUpsell.displayPrice,
      strikethroughPrice: checkoutUpsell.strikethroughPrice,
      urgencyMessage: checkoutUpsell.urgencyMessage,
      checkboxLabel: checkoutUpsell.checkboxLabel,
      productName: products.name,
      productSlug: products.slug,
      productImage: products.imageUrl,
      variantId: productVariants.id,
      variantName: productVariants.name,
      variantPrice: productVariants.priceUsd,
      platform: productVariants.platform,
    })
    .from(checkoutUpsell)
    .innerJoin(products, eq(checkoutUpsell.productId, products.id))
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isActive, true)))
    .where(eq(checkoutUpsell.isActive, true))
    .limit(1);

  if (!row) { res.json({ upsell: null }); return; }
  res.json({ upsell: row });
});

export default router;
