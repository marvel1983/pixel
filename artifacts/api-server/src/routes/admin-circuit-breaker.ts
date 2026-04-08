import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import {
  getAllCircuitStatus,
  getCircuitBreaker,
} from "../lib/circuit-breaker";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/system-status/circuits", ...guard, async (_req, res) => {
  const circuits = getAllCircuitStatus();
  res.json({ circuits });
});

router.post("/admin/system-status/circuits/:name/reset", ...guard, async (req, res) => {
  const cb = getCircuitBreaker(req.params.name);
  if (!cb) {
    res.status(404).json({ error: "Circuit breaker not found" });
    return;
  }
  cb.reset();
  res.json({ success: true, circuit: cb.getInfo() });
});

export default router;
