import { registerQueueWorker, registerWorker, enqueueRecurring, type QueueName } from "./job-queue";
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

interface RecurringJobDef {
  queue: QueueName;
  name: string;
  intervalMs: number;
}

const RECURRING_JOBS: RecurringJobDef[] = [
  { queue: "email", name: "process-queue", intervalMs: 60_000 },
  { queue: "product-sync", name: "sync-all", intervalMs: 30 * 60_000 },
  { queue: "abandoned-cart", name: "process-carts", intervalMs: 15 * 60_000 },
  { queue: "alerts", name: "trustpilot-invites", intervalMs: 30 * 60_000 },
  { queue: "alerts", name: "survey-emails", intervalMs: 4 * 60 * 60_000 },
  { queue: "alerts", name: "affiliate-commissions", intervalMs: 6 * 60 * 60_000 },
];

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export async function scheduleRecurringJobs() {
  for (const def of RECURRING_JOBS) {
    await enqueueRecurring({
      queue: def.queue,
      name: def.name,
      priority: 1,
      intervalMs: def.intervalMs,
    });
  }

  schedulerTimer = setInterval(async () => {
    for (const def of RECURRING_JOBS) {
      try {
        await enqueueRecurring({
          queue: def.queue,
          name: def.name,
          priority: 1,
          intervalMs: def.intervalMs,
        });
      } catch (err) {
        logger.error({ err, queue: def.queue, name: def.name }, "Failed to schedule recurring job");
      }
    }
  }, 60_000);

  logger.info("Recurring jobs scheduled");
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
