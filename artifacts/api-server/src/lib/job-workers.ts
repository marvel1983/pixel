import { registerQueueWorker, registerWorker, enqueueRecurringIfDue, type QueueName, PRIORITY, type Priority } from "./job-queue";
import { syncProducts } from "./product-sync";
import { processEmailQueue } from "./email";
import { approveHeldCommissions } from "../services/affiliate-service";
import { processAbandonedCarts } from "../services/abandoned-cart-service";
import { processPendingInvites } from "../services/trustpilot-service";
import { processSurveyEmails } from "../services/survey-service";
import { logger } from "./logger";

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

  registerWorker("reports", "generate", async (payload) => {
    logger.info({ payload }, "Report generation placeholder");
  });

  registerWorker("order-processing", "metenzi-retry-fulfillment", async (payload) => {
    const { orderId, items } = payload as { orderId: number; items: Array<{ variantId: number; quantity: number }> };
    const { getMetenziConfig } = await import("../lib/metenzi-config");
    const { createOrder: metenziCreateOrder } = await import("../lib/metenzi-endpoints");
    const config = await getMetenziConfig();
    if (!config) { logger.warn({ orderId }, "Metenzi not configured, skipping retry"); return; }
    const metenziItems = items.map((it) => ({ variantId: String(it.variantId), quantity: it.quantity }));
    const metenziOrder = await metenziCreateOrder(config, metenziItems);
    const { db } = await import("@workspace/db");
    const { orders } = await import("@workspace/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(orders).set({ externalOrderId: metenziOrder.id, status: "PROCESSING" }).where(eq(orders.id, orderId));
    logger.info({ orderId, metenziOrderId: metenziOrder.id }, "Metenzi retry fulfillment succeeded");
  });

  registerQueueWorker("order-processing", async (payload) => {
    logger.info({ payload }, "Order processing placeholder");
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
