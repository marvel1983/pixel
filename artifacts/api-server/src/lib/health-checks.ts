import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getAllCircuitStatus } from "./circuit-breaker";
import { logger } from "./logger";

export interface DependencyCheck {
  name: string;
  status: "up" | "down";
  latencyMs: number;
  lastChecked: string;
  error?: string;
}

async function timedCheck(fn: () => Promise<void>): Promise<{ ok: boolean; ms: number; error?: string }> {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkDatabase(): Promise<DependencyCheck> {
  const now = new Date().toISOString();
  const result = await timedCheck(async () => {
    await db.execute(sql`SELECT 1`);
  });
  return {
    name: "database",
    status: result.ok ? "up" : "down",
    latencyMs: result.ms,
    lastChecked: now,
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function checkSmtp(): Promise<DependencyCheck> {
  const now = new Date().toISOString();
  const { siteSettings } = await import("@workspace/db/schema");
  const rows = await db.select({
    host: siteSettings.smtpHost,
    port: siteSettings.smtpPort,
    user: siteSettings.smtpUser,
  }).from(siteSettings).limit(1);

  if (!rows[0]?.host || !rows[0]?.user) {
    return { name: "smtp", status: "down", latencyMs: 0, lastChecked: now, error: "SMTP not configured" };
  }

  const result = await timedCheck(async () => {
    const net = await import("net");
    await new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host: rows[0].host!, port: rows[0].port ?? 587, timeout: 5000 });
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("error", (err) => { socket.destroy(); reject(err); });
      socket.once("timeout", () => { socket.destroy(); reject(new Error("Connection timeout")); });
    });
  });

  return {
    name: "smtp",
    status: result.ok ? "up" : "down",
    latencyMs: result.ms,
    lastChecked: now,
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function checkMetenzi(): Promise<DependencyCheck> {
  const now = new Date().toISOString();
  const circuits = getAllCircuitStatus();
  const metenzi = circuits["metenzi"];

  if (metenzi?.state === "OPEN") {
    return { name: "metenzi", status: "down", latencyMs: 0, lastChecked: now, error: "Circuit breaker OPEN" };
  }

  const { getMetenziConfig } = await import("./metenzi-config");
  const config = await getMetenziConfig();
  if (!config) {
    return { name: "metenzi", status: "down", latencyMs: 0, lastChecked: now, error: "Not configured" };
  }

  const result = await timedCheck(async () => {
    const res = await fetch(`${config.baseUrl}/products?limit=1`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status >= 500) throw new Error(`HTTP ${res.status}`);
  });

  return {
    name: "metenzi",
    status: result.ok ? "up" : "down",
    latencyMs: result.ms,
    lastChecked: now,
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function checkPaymentGateway(): Promise<DependencyCheck> {
  const now = new Date().toISOString();
  const circuits = getAllCircuitStatus();
  const checkout = circuits["checkout"];

  if (checkout?.state === "OPEN") {
    return { name: "payment", status: "down", latencyMs: 0, lastChecked: now, error: "Circuit breaker OPEN" };
  }

  const result = await timedCheck(async () => {
    const res = await fetch("https://api.sandbox.checkout.com/", {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 500) throw new Error(`Checkout.com HTTP ${res.status}`);
  });

  return {
    name: "payment",
    status: result.ok ? "up" : "down",
    latencyMs: result.ms,
    lastChecked: now,
    ...(result.error ? { error: result.error } : {}),
  };
}

export async function runAllChecks(): Promise<DependencyCheck[]> {
  const results = await Promise.allSettled([
    checkDatabase(),
    checkSmtp(),
    checkMetenzi(),
    checkPaymentGateway(),
  ]);
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const names = ["database", "smtp", "metenzi", "payment"];
    logger.error({ err: r.reason }, `Health check failed for ${names[i]}`);
    return {
      name: names[i],
      status: "down" as const,
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });
}

export function deriveOverallStatus(checks: DependencyCheck[]): "healthy" | "degraded" | "unhealthy" {
  const downCount = checks.filter((c) => c.status === "down").length;
  const dbDown = checks.find((c) => c.name === "database")?.status === "down";
  if (dbDown) return "unhealthy";
  if (downCount === 0) return "healthy";
  return "degraded";
}
