import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { metenziProductMappings } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

router.get("/admin/metenzi/mappings", ...guard, async (_req, res) => {
  const mappings = await db
    .select({
      id: metenziProductMappings.id,
      metenziProductId: metenziProductMappings.metenziProductId,
      metenziSku: metenziProductMappings.metenziSku,
      metenziName: metenziProductMappings.metenziName,
      pixelProductId: metenziProductMappings.pixelProductId,
      autoSyncStock: metenziProductMappings.autoSyncStock,
      lastStockSyncAt: metenziProductMappings.lastStockSyncAt,
      lastSyncedAt: metenziProductMappings.lastSyncedAt,
    })
    .from(metenziProductMappings);
  res.json(mappings);
});

const createMappingSchema = z.object({
  metenziProductId: z.string().min(1),
  metenziSku: z.string().optional(),
  metenziName: z.string().optional(),
  pixelProductId: z.number().int().positive(),
});

router.post("/admin/metenzi/mappings", ...guard, async (req, res) => {
  const parsed = createMappingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { metenziProductId, metenziSku, metenziName, pixelProductId } = parsed.data;
  await db.delete(metenziProductMappings).where(eq(metenziProductMappings.metenziProductId, metenziProductId));
  const [mapping] = await db.insert(metenziProductMappings).values({ metenziProductId, metenziSku, metenziName, pixelProductId }).returning();
  res.json(mapping);
});

router.delete("/admin/metenzi/mappings/:id", ...guard, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(metenziProductMappings).where(eq(metenziProductMappings.id, id));
  res.json({ success: true });
});

router.patch("/admin/metenzi/mappings/:id", ...guard, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof req.body.autoSyncStock === "boolean") updates.autoSyncStock = req.body.autoSyncStock;
  if (req.body.pixelProductId !== undefined) updates.pixelProductId = req.body.pixelProductId;
  await db.update(metenziProductMappings).set(updates).where(eq(metenziProductMappings.id, id));
  res.json({ success: true });
});

export default router;
