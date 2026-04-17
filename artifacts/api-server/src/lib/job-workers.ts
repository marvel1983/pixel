import { registerQueueWorker, registerWorker, enqueueRecurringIfDue, type QueueName, PRIORITY, type Priority } from "./job-queue";
import { syncProducts } from "./product-sync";
import { processEmailQueue } from "./email";
import { approveHeldCommissions } from "../services/affiliate-service";
import { processAbandonedCarts } from "../services/abandoned-cart-service";
import { processPendingInvites } from "../services/trustpilot-service";
import { processSurveyEmails } from "../services/survey-service";
import { syncCurrencyRates } from "./currency-sync";
import { processExpiredPoints, sendExpiryWarningEmails } from "../services/loyalty-service";
import { logger } from "./logger";
import { metenziProductMappings } from "@workspace/db/schema";

export function registerAllWorkers() {
  registerQueueWorker("email", async () => {
    await processEmailQueue();
  });

  registerQueueWorker("product-sync", async () => {
    await syncProducts();
  });

  registerQueueWorker("abandoned-cart", async () => {
    await processAbandonedCarts();
  });

  registerWorker("alerts", "trustpilot-invites", async () => {
    await processPendingInvites();
  });

  registerWorker("alerts", "survey-emails", async () => {
    await processSurveyEmails();
  });

  registerWorker("alerts", "affiliate-commissions", async () => {
    await approveHeldCommissions();
  });

  registerWorker("reports", "sync-currency-rates", async () => {
    await syncCurrencyRates();
  });

  registerWorker("reports", "loyalty-expiry-process", async () => {
    await processExpiredPoints();
  });

  registerWorker("reports", "loyalty-expiry-warnings", async () => {
    await sendExpiryWarningEmails();
  });

  registerWorker("alerts", "birthday-bonuses", async () => {
    const { processBirthdayBonuses } = await import("../services/loyalty-service");
    await processBirthdayBonuses();
  });

  registerWorker("reports", "generate", async (payload) => {
    logger.info({ payload }, "Report generation placeholder");
  });

  registerWorker("order-processing", "metenzi-retry-fulfillment", async (payload) => {
    const { orderId, productIds } = payload as { orderId: number; productIds: number[] };
    const { getMetenziConfig } = await import("../lib/metenzi-config");
    const { createOrder: metenziCreateOrder } = await import("../lib/metenzi-endpoints");
    const { db } = await import("@workspace/db");
    const { orders, orderItems } = await import("@workspace/db/schema");
    const { eq, inArray, isNotNull, and } = await import("drizzle-orm");

    const config = await getMetenziConfig();
    if (!config) { logger.warn({ orderId }, "Metenzi not configured, skipping retry"); return; }

    // Re-resolve Metenzi product IDs from productIds
    const mappings = productIds.length
      ? await db
          .select({ pixelProductId: metenziProductMappings.pixelProductId, metenziProductId: metenziProductMappings.metenziProductId })
          .from(metenziProductMappings)
          .where(and(inArray(metenziProductMappings.pixelProductId, productIds), isNotNull(metenziProductMappings.pixelProductId)))
      : [];
    const mappingMap = new Map(mappings.filter((m) => m.pixelProductId !== null).map((m) => [m.pixelProductId!, m.metenziProductId]));

    // Get order items quantities
    const dbItems = await db.select({ variantId: orderItems.variantId, quantity: orderItems.quantity, productId: orderItems.variantId })
      .from(orderItems).where(eq(orderItems.orderId, orderId));

    const metenziItems: { variantId: string; quantity: number }[] = [];
    for (const pid of productIds) {
      const metenziId = mappingMap.get(pid);
      if (!metenziId) continue;
      const qty = dbItems.reduce((s, i) => s + i.quantity, 0) || 1;
      metenziItems.push({ variantId: metenziId, quantity: qty });
    }

    if (metenziItems.length === 0) { logger.warn({ orderId }, "Retry: no Metenzi-mapped items found"); return; }

    const metenziOrder = await metenziCreateOrder(config, metenziItems);
    await db.update(orders).set({ externalOrderId: metenziOrder.id, status: "PROCESSING" }).where(eq(orders.id, orderId));
    logger.info({ orderId, metenziOrderId: metenziOrder.id, keysInResponse: metenziOrder.keys?.length ?? 0 }, "Metenzi retry fulfillment succeeded");

    // Handle immediate key delivery if Metenzi already returned keys
    if (metenziOrder.status === "paid" && (metenziOrder.keys?.length ?? 0) > 0) {
      const { handleWebhookEvent } = await import("../services/webhook-handlers");
      await handleWebhookEvent("order.fulfilled", { id: metenziOrder.id, keys: metenziOrder.keys });
    }
  });

  registerQueueWorker("order-processing", async (payload) => {
    logger.info({ payload }, "Order processing placeholder");
  });

  registerWorker("reports", "health-monitor", async () => {
    const { runHealthMonitorCycle } = await import("./health-monitor");
    await runHealthMonitorCycle();
  });

  registerWorker("reports", "health-cleanup", async () => {
    const { cleanupOldIncidents } = await import("./health-monitor");
    const count = await cleanupOldIncidents();
    if (count > 0) logger.info({ count }, "Cleaned old health incidents");
  });

  registerWorker("reports", "idempotency-cleanup", async () => {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    const result = await db.execute(sql`DELETE FROM idempotency_keys WHERE expires_at < NOW()`);
    const count = result.rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Cleaned expired idempotency keys");
  });

  registerWorker("email", "circuit-breaker-alert", async (payload) => {
    const { service, from, to, failures, lastError } = payload as Record<string, unknown>;
    logger.warn({ service, from, to, failures }, "Circuit breaker OPEN alert");
    const { enqueueEmail } = await import("./email/queue");
    const subject = `[ALERT] Circuit Breaker OPEN: ${service}`;
    const html = `<h2>Circuit Breaker Alert</h2>
      <p>The <strong>${service}</strong> service circuit breaker has transitioned from <strong>${from}</strong> to <strong>${to}</strong>.</p>
      <p><strong>Failures:</strong> ${failures}</p>
      <p><strong>Last Error:</strong> ${lastError || "N/A"}</p>
      <p>Requests to this service are being rejected with fallback responses. Check the <a href="/admin/system-status">System Status</a> page for details.</p>`;
    const { db } = await import("@workspace/db");
    const { siteSettings } = await import("@workspace/db/schema");
    const rows = await db.select({ email: siteSettings.contactEmail }).from(siteSettings).limit(1);
    const adminEmail = rows[0]?.email || "admin@pixelcodes.com";
    await enqueueEmail(adminEmail, subject, html, { type: "circuit-breaker-alert", service });
  });

  registerWorker("imports", "process-user-import", async (payload) => {
    const { importJobId } = payload as { importJobId: number };
    const { processImportJob } = await import("../services/user-import-service");
    await processImportJob(importJobId);
  });

  logger.info("All job workers registered");
}

interface RecurringDef {
  queue: QueueName;
  name: string;
  intervalMs: number;
  priority: Priority;
}

const RECURRING: RecurringDef[] = [
  { queue: "email", name: "process-queue", intervalMs: 60_000, priority: PRIORITY.HIGH },
  { queue: "product-sync", name: "sync-all", intervalMs: 30 * 60_000, priority: PRIORITY.NORMAL },
  { queue: "abandoned-cart", name: "process-carts", intervalMs: 15 * 60_000, priority: PRIORITY.NORMAL },
  { queue: "alerts", name: "trustpilot-invites", intervalMs: 30 * 60_000, priority: PRIORITY.LOW },
  { queue: "alerts", name: "survey-emails", intervalMs: 4 * 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "alerts", name: "affiliate-commissions", intervalMs: 6 * 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "reports", name: "idempotency-cleanup", intervalMs: 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "reports", name: "health-monitor", intervalMs: 60_000, priority: PRIORITY.NORMAL },
  { queue: "reports", name: "health-cleanup", intervalMs: 24 * 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "reports", name: "sync-currency-rates", intervalMs: 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "reports", name: "loyalty-expiry-process", intervalMs: 24 * 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "reports", name: "loyalty-expiry-warnings", intervalMs: 24 * 60 * 60_000, priority: PRIORITY.LOW },
  { queue: "alerts", name: "birthday-bonuses", intervalMs: 24 * 60 * 60_000, priority: PRIORITY.LOW },
];

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

async function enqueueAllDue() {
  for (const def of RECURRING) {
    try {
      await enqueueRecurringIfDue(def.queue, def.name, def.intervalMs, def.priority);
    } catch (err) {
      logger.error({ err, queue: def.queue, name: def.name }, "Failed to schedule recurring job");
    }
  }
}

export async function scheduleRecurringJobs() {
  await enqueueAllDue();
  schedulerTimer = setInterval(enqueueAllDue, 30_000);
  logger.info("Recurring jobs scheduled");
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
