import cron, { type ScheduledTask } from "node-cron";
import { syncProducts } from "./product-sync";
import { processEmailQueue } from "./email";
import { approveHeldCommissions } from "../services/affiliate-service";
import { logger } from "./logger";

let syncTask: ScheduledTask | null = null;
let emailTask: ScheduledTask | null = null;
let affiliateTask: ScheduledTask | null = null;

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

  affiliateTask = cron.schedule("0 */6 * * *", async () => {
    try {
      const approved = await approveHeldCommissions();
      if (approved > 0) {
        logger.info({ approved }, "Cron: affiliate held commissions approved");
      }
    } catch (error) {
      logger.error({ error }, "Cron: affiliate commission approval failed");
    }
  });

  logger.info("Cron jobs started (product sync 30m, email queue 1m, affiliate approval 6h)");
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
  if (affiliateTask) {
    affiliateTask.stop();
    affiliateTask = null;
  }
  logger.info("Cron jobs stopped");
}
