import { db } from "@workspace/db";
import { healthIncidents } from "@workspace/db/schema";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { runAllChecks, type DependencyCheck } from "./health-checks";
import { logger } from "./logger";

const lastKnownStatus = new Map<string, "up" | "down">();
// Tracks consecutive failures per service — alert only fires after ALERT_THRESHOLD consecutive downs
const consecutiveFailures = new Map<string, number>();
const ALERT_THRESHOLD = 2;

export async function runHealthMonitorCycle(): Promise<void> {
  const checks = await runAllChecks();
  for (const check of checks) {
    const prev = lastKnownStatus.get(check.name);

    await db.insert(healthIncidents).values({
      service: check.name,
      status: check.status,
      latencyMs: check.latencyMs,
      error: check.error ?? null,
    });

    if (check.status === "down") {
      const failures = (consecutiveFailures.get(check.name) ?? 0) + 1;
      consecutiveFailures.set(check.name, failures);

      if (failures === ALERT_THRESHOLD) {
        // Only alert on exactly the threshold hit to avoid repeated alerts
        lastKnownStatus.set(check.name, "down");
        logger.warn({ service: check.name, failures }, "Health alert: service down after consecutive failures");
        await sendHealthAlert(check);
      } else if (failures < ALERT_THRESHOLD) {
        logger.warn({ service: check.name, failures, threshold: ALERT_THRESHOLD }, "Health check failed (below alert threshold)");
      }
    } else {
      const wasDown = consecutiveFailures.get(check.name) ?? 0;
      consecutiveFailures.set(check.name, 0);
      lastKnownStatus.set(check.name, "up");

      if (prev === "down" || wasDown >= ALERT_THRESHOLD) {
        logger.info({ service: check.name }, "Health status recovered");
      }
    }
  }
}

async function sendHealthAlert(check: DependencyCheck): Promise<void> {
  try {
    const { enqueueEmail } = await import("./email/queue");
    const { siteSettings } = await import("@workspace/db/schema");
    const rows = await db.select({ email: siteSettings.contactEmail }).from(siteSettings).limit(1);
    const adminEmail = rows[0]?.email || "admin@pixelcodes.com";
    const subject = `[ALERT] Service DOWN: ${check.name}`;
    const html = `<h2>Health Check Alert</h2>
      <p>The <strong>${check.name}</strong> service is now <span style="color:red">DOWN</span>.</p>
      <p><strong>Error:</strong> ${check.error || "Unknown"}</p>
      <p><strong>Latency:</strong> ${check.latencyMs}ms</p>
      <p><strong>Time:</strong> ${check.lastChecked}</p>
      <p>Check the <a href="/admin/system-status">System Status</a> page for details.</p>`;
    await enqueueEmail(adminEmail, subject, html, { type: "health-alert", service: check.name });
  } catch (err) {
    logger.error({ err, service: check.name }, "Failed to send health alert email");
  }
}

export async function getUptimeStats(service: string): Promise<{ h24: number; d7: number; d30: number }> {
  const now = new Date();
  const calc = async (since: Date) => {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'up') AS up_count,
        COUNT(*) AS total
      FROM health_incidents
      WHERE service = ${service} AND created_at >= ${since}
    `);
    const row = (result.rows as Array<{ up_count: string; total: string }>)[0];
    if (!row || parseInt(row.total) === 0) return 100;
    return Math.round((parseInt(row.up_count) / parseInt(row.total)) * 10000) / 100;
  };

  const [h24, d7, d30] = await Promise.all([
    calc(new Date(now.getTime() - 24 * 60 * 60_000)),
    calc(new Date(now.getTime() - 7 * 24 * 60 * 60_000)),
    calc(new Date(now.getTime() - 30 * 24 * 60 * 60_000)),
  ]);
  return { h24, d7, d30 };
}

export async function getRecentIncidents(limit = 50): Promise<Array<{
  id: number; service: string; status: string; latencyMs: number | null;
  error: string | null; createdAt: Date;
}>> {
  return db.select().from(healthIncidents)
    .orderBy(desc(healthIncidents.createdAt))
    .limit(limit);
}

export async function getStatusChangeIncidents(limit = 20): Promise<Array<{
  service: string; status: string; error: string | null; createdAt: Date;
}>> {
  const rows = await db.execute(sql`
    SELECT service, status, error, created_at
    FROM (
      SELECT service, status, error, created_at,
        LAG(status) OVER (PARTITION BY service ORDER BY created_at) AS prev_status
      FROM health_incidents
      ORDER BY created_at DESC
      LIMIT 500
    ) sub
    WHERE prev_status IS NOT NULL AND status != prev_status
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  return (rows.rows as Array<{ service: string; status: string; error: string | null; created_at: Date }>)
    .map((r) => ({ service: r.service, status: r.status, error: r.error, createdAt: r.created_at }));
}

export async function cleanupOldIncidents(): Promise<number> {
  const cutoff = new Date(Date.now() - 31 * 24 * 60 * 60_000);
  const result = await db.execute(
    sql`DELETE FROM health_incidents WHERE created_at < ${cutoff}`,
  );
  return result.rowCount ?? 0;
}
