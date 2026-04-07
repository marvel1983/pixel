import cron from "node-cron";
import { syncProducts } from "./product-sync";
import { logger } from "./logger";

let syncTask: cron.ScheduledTask | null = null;

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

  logger.info("Cron jobs started (product sync every 30 minutes)");
}

export function stopCronJobs(): void {
  if (syncTask) {
    syncTask.stop();
    syncTask = null;
    logger.info("Cron jobs stopped");
  }
}
