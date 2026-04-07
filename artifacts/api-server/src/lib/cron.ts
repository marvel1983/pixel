import cron, { type ScheduledTask } from "node-cron";
import { syncProducts } from "./product-sync";
import { processEmailQueue } from "./email";
import { logger } from "./logger";

let syncTask: ScheduledTask | null = null;
let emailTask: ScheduledTask | null = null;

export function startCronJobs(): void {
  if (syncTask) return;

  syncTask = cron.schedule("*/30 * * * *", async () => {
    logger.info("Cron: triggering product sync");
    try {
      const result = await syncProducts();
      logger.info(result, "Cron: product sync finished");
    } catch (error) {
      logger.error({ error }, "Cron: product sync failed");
    }
  });

  emailTask = cron.schedule("* * * * *", async () => {
    try {
      const result = await processEmailQueue();
      if (result.processed > 0 || result.failed > 0) {
        logger.info(result, "Cron: email queue processed");
      }
    } catch (error) {
      logger.error({ error }, "Cron: email queue processing failed");
    }
  });

  logger.info("Cron jobs started (product sync 30m, email queue 1m)");
}

export function stopCronJobs(): void {
  if (syncTask) {
    syncTask.stop();
    syncTask = null;
  }
  if (emailTask) {
    emailTask.stop();
    emailTask = null;
  }
  logger.info("Cron jobs stopped");
}
