import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { runAllChecks, deriveOverallStatus, type DependencyCheck } from "../lib/health-checks";
import { getUptimeStats, getStatusChangeIncidents } from "../lib/health-monitor";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/health", async (_req, res) => {
  const start = Date.now();
  try {
    const checks = await runAllChecks();
    const overall = deriveOverallStatus(checks);
    const responseTimeMs = Date.now() - start;
    const statusCode = overall === "healthy" ? 200 : 503;
    res.status(statusCode).json({
      status: overall,
      responseTimeMs,
      timestamp: new Date().toISOString(),
      services: checks.reduce((acc, c) => {
        acc[c.name] = { status: c.status, latencyMs: c.latencyMs };
        return acc;
      }, {} as Record<string, { status: string; latencyMs: number }>),
    });
  } catch {
    res.status(503).json({ status: "unhealthy", responseTimeMs: Date.now() - start, timestamp: new Date().toISOString(), services: {} });
  }
});

const guard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/health/detailed", ...guard, async (_req, res) => {
  const start = Date.now();
  try {
    const checks = await runAllChecks();
    const overall = deriveOverallStatus(checks);
    const responseTimeMs = Date.now() - start;

    const uptimePromises = checks.map(async (c) => {
      const uptime = await getUptimeStats(c.name);
      return { ...c, uptime };
    });
    const detailed = await Promise.all(uptimePromises);
    const incidents = await getStatusChangeIncidents(20);

    const statusCode = overall === "healthy" ? 200 : 503;
    res.status(statusCode).json({
      status: overall,
      responseTimeMs,
      timestamp: new Date().toISOString(),
      services: detailed,
      incidents: incidents.map((i) => ({
        service: i.service,
        status: i.status,
        error: i.error,
        at: i.createdAt,
      })),
    });
  } catch {
    res.status(503).json({ status: "unhealthy", responseTimeMs: Date.now() - start, timestamp: new Date().toISOString(), services: [], incidents: [] });
  }
});

export default router;
