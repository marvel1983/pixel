import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";
import {
  getConflictStats,
  listPendingConflicts,
  resolveConflict,
  type ResolveAction,
} from "../services/mapping-conflicts";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageProducts")];

router.get("/admin/metenzi/mapping-conflicts/stats", ...guard, async (_req, res) => {
  res.json(await getConflictStats());
});

router.get("/admin/metenzi/mapping-conflicts", ...guard, async (_req, res) => {
  const conflicts = await listPendingConflicts();
  res.json({ conflicts, count: conflicts.length });
});

router.post("/admin/metenzi/mapping-conflicts/:id/resolve", ...guard, async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid conflict ID" }); return; }

  const body = req.body as { action?: string; note?: string; pixelProductId?: number };
  const validActions: ResolveAction[] = ["link_existing", "create_new", "dismiss"];
  if (!body.action || !validActions.includes(body.action as ResolveAction)) {
    res.status(400).json({ error: "action must be one of: link_existing | create_new | dismiss" }); return;
  }

  const result = await resolveConflict({
    conflictId: id,
    action: body.action as ResolveAction,
    adminUserId: req.user?.userId ?? null,
    note: body.note,
  });
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ success: true, status: result.status });
});

export default router;
