import { Router } from "express";
import { db } from "@workspace/db";
import { productVariants } from "@workspace/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { syncProducts } from "../lib/product-sync";
import { getMetenziConfig } from "../lib/metenzi-config";

const router = Router();

router.get(
  "/admin/platforms/stats",
  requireAuth, requireAdmin, requirePermission("manageProducts"),
  async (_req, res) => {
    const rows = await db
      .select({
        platform: productVariants.platform,
        variantCount: count(productVariants.id),
        productCount: sql<number>`count(distinct ${productVariants.productId})`,
      })
      .from(productVariants)
      .where(sql`${productVariants.platform} IS NOT NULL`)
      .groupBy(productVariants.platform);
    res.json({ stats: rows });
  },
);

router.post(
  "/admin/platforms/sync",
  requireAuth, requireAdmin, requirePermission("manageProducts"),
  async (_req, res) => {
    const config = await getMetenziConfig();
    if (!config) {
      res.status(400).json({ error: "Metenzi not configured" });
      return;
    }
    const result = await syncProducts();
    res.json(result);
  },
);

router.patch(
  "/admin/platforms/variant/:id",
  requireAuth, requireAdmin, requirePermission("manageProducts"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { platform } = req.body as { platform: string };
    if (!platform || typeof platform !== "string" || platform.trim().length === 0 || platform.length > 50) {
      res.status(400).json({ error: "Invalid platform" });
      return;
    }
    await db
      .update(productVariants)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ platform: platform as any, updatedAt: new Date() })
      .where(eq(productVariants.id, id));
    res.json({ ok: true });
  },
);

export default router;
