import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { seoTracking } from "@workspace/db/schema";

let cachedMaintenance: { mode: boolean; bypassIps: string[]; message: string; estimate: string | null } | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

async function getMaintenanceState() {
  if (cachedMaintenance && Date.now() - cacheTime < CACHE_TTL) return cachedMaintenance;
  const rows = await db.select({
    maintenanceMode: seoTracking.maintenanceMode,
    maintenanceBypassIps: seoTracking.maintenanceBypassIps,
    maintenanceMessage: seoTracking.maintenanceMessage,
    maintenanceEstimate: seoTracking.maintenanceEstimate,
  }).from(seoTracking);
  if (!rows[0]) {
    cachedMaintenance = { mode: false, bypassIps: [], message: "", estimate: null };
  } else {
    cachedMaintenance = {
      mode: rows[0].maintenanceMode,
      bypassIps: rows[0].maintenanceBypassIps ?? [],
      message: rows[0].maintenanceMessage,
      estimate: rows[0].maintenanceEstimate,
    };
  }
  cacheTime = Date.now();
  return cachedMaintenance;
}

const ADMIN_PREFIXES = ["/admin", "/auth", "/maintenance-status", "/robots.txt"];

export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  if (ADMIN_PREFIXES.some((p) => path.startsWith(p))) {
    next(); return;
  }

  const state = await getMaintenanceState();
  if (!state.mode) { next(); return; }

  const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "";
  if (state.bypassIps.length > 0 && state.bypassIps.includes(clientIp)) {
    next(); return;
  }

  res.status(503).json({
    maintenance: true,
    message: state.message,
    estimate: state.estimate,
  });
}

export function invalidateMaintenanceCache() {
  cachedMaintenance = null;
  cacheTime = 0;
}
