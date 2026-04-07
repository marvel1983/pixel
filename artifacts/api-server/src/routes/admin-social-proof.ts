import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/social-proof", auth, async (_req, res) => {
  const rows = await db.select().from(siteSettings).limit(1);
  const s = rows[0];
  if (!s) return res.json({});
  res.json({
    spViewersEnabled: s.spViewersEnabled,
    spViewersMin: s.spViewersMin,
    spSoldEnabled: s.spSoldEnabled,
    spSoldMin: s.spSoldMin,
    spToastEnabled: s.spToastEnabled,
    spToastIntervalMin: s.spToastIntervalMin,
    spToastIntervalMax: s.spToastIntervalMax,
    spToastMaxPerSession: s.spToastMaxPerSession,
    spStockUrgencyEnabled: s.spStockUrgencyEnabled,
    spStockLowThreshold: s.spStockLowThreshold,
    spStockCriticalThreshold: s.spStockCriticalThreshold,
  });
});

router.put("/admin/social-proof", auth, async (req, res) => {
  const rows = await db.select().from(siteSettings).limit(1);
  if (!rows.length) return res.status(404).json({ error: "No settings" });

  const allowed = [
    "spViewersEnabled", "spViewersMin",
    "spSoldEnabled", "spSoldMin",
    "spToastEnabled", "spToastIntervalMin", "spToastIntervalMax", "spToastMaxPerSession",
    "spStockUrgencyEnabled", "spStockLowThreshold", "spStockCriticalThreshold",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: "No fields" });

  const numFields = ["spViewersMin", "spSoldMin", "spToastIntervalMin", "spToastIntervalMax", "spToastMaxPerSession", "spStockLowThreshold", "spStockCriticalThreshold"];
  for (const f of numFields) {
    if (updates[f] !== undefined && (typeof updates[f] !== "number" || updates[f] < 0)) {
      return res.status(400).json({ error: `${f} must be a non-negative number` });
    }
  }

  await db.update(siteSettings).set(updates).where(eq(siteSettings.id, rows[0].id));
  res.json({ ok: true });
});

export default router;
