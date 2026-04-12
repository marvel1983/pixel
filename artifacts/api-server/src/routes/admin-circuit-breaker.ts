import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import {
  getAllCircuitStatus,
  getCircuitBreaker,
} from "../lib/circuit-breaker";
import { paramString } from "../lib/route-params";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/system-status/circuits", ...guard, async (_req, res) => {
  const circuits = getAllCircuitStatus();
  const alerts: string[] = [];
  for (const [name, info] of Object.entries(circuits)) {
    if (info.state === "OPEN") {
      if (name === "metenzi") alerts.push("Supplier Temporarily Unavailable");
      else if (name === "checkout") alerts.push("Payment Processing Unavailable");
      else alerts.push(`${name} service unavailable`);
    }
  }
  res.json({ circuits, alerts });
});

router.post("/admin/system-status/circuits/:name/reset", ...guard, async (req, res) => {
  const cb = getCircuitBreaker(paramString(req.params, "name"));
  if (!cb) {
    res.status(404).json({ error: "Circuit breaker not found" });
    return;
  }
  cb.reset();
  res.json({ success: true, circuit: cb.getInfo() });
});

export default router;
