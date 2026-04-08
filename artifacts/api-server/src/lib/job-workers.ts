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

  registerQueueWorker("order-processing", async (payload) => {
    logger.info({ payload }, "Order processing placeholder");
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
