import { Router, type Request } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { metenziProductMappings, auditLog } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { logger } from "../lib/logger";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

async function audit(action: "CREATE" | "UPDATE" | "DELETE", req: Request, entityId: number | null, details: Record<string, unknown>) {
  try {
    await db.insert(auditLog).values({
      action,
      entityType: "metenzi_mapping",
      entityId,
      userId: req.user?.userId ?? null,
      details,
    });
  } catch (err) {
    logger.error({ err, details }, "Failed to write mapping audit log");
  }
}

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
  // Upsert: if a (possibly disabled) row exists for this Metenzi UUID, reactivate
  // and re-point it. Otherwise insert. Don't DELETE — the row carries audit
  // history and disabled state we want to preserve.
  const [existing] = await db.select().from(metenziProductMappings).where(eq(metenziProductMappings.metenziProductId, metenziProductId)).limit(1);
  let mapping;
  if (existing) {
    [mapping] = await db.update(metenziProductMappings)
      .set({ pixelProductId, metenziSku: metenziSku ?? null, metenziName: metenziName ?? null, disabled: false, updatedAt: new Date() })
      .where(eq(metenziProductMappings.id, existing.id))
      .returning();
    await audit("UPDATE", req, pixelProductId, {
      kind: "admin_mapped",
      mappingId: existing.id,
      metenziProductId,
      previousPixelProductId: existing.pixelProductId,
      reactivated: existing.disabled,
    });
  } else {
    [mapping] = await db.insert(metenziProductMappings)
      .values({ metenziProductId, metenziSku, metenziName, pixelProductId })
      .returning();
    await audit("CREATE", req, pixelProductId, { kind: "admin_mapped", mappingId: mapping.id, metenziProductId });
  }
  res.json(mapping);
});

router.delete("/admin/metenzi/mappings/:id", ...guard, async (req, res) => {
  const id = parseInt(req.params.id as string);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Soft unmap: set disabled=true so sync respects the admin's decision and
  // doesn't auto-recreate the link on the next pass. Use POST .../mappings to
  // re-link or DELETE again with ?hard=1 for hard delete (rare).
  if (req.query.hard === "1") {
    const [existing] = await db.select().from(metenziProductMappings).where(eq(metenziProductMappings.id, id)).limit(1);
    if (!existing) { res.status(404).json({ error: "Mapping not found" }); return; }
    await db.delete(metenziProductMappings).where(eq(metenziProductMappings.id, id));
    await audit("DELETE", req, existing.pixelProductId, { kind: "admin_unmapped_hard", mappingId: id, metenziProductId: existing.metenziProductId });
    res.json({ success: true, mode: "hard" });
    return;
  }
  const [existing] = await db.select().from(metenziProductMappings).where(eq(metenziProductMappings.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Mapping not found" }); return; }
  await db.update(metenziProductMappings)
    .set({ disabled: true, pixelProductId: null, updatedAt: new Date() })
    .where(eq(metenziProductMappings.id, id));
  await audit("UPDATE", req, existing.pixelProductId, { kind: "admin_unmapped_soft", mappingId: id, metenziProductId: existing.metenziProductId, previousPixelProductId: existing.pixelProductId });
  res.json({ success: true, mode: "soft" });
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
