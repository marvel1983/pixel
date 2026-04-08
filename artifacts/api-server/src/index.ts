import app from "./app";
import { logger } from "./lib/logger";
import { startJobProcessor, stopJobProcessor } from "./lib/job-queue";
import { registerAllWorkers, scheduleRecurringJobs, stopScheduler } from "./lib/job-workers";
import { seedDefaultLocales } from "./lib/seed-locales";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function bootstrap() {
  try {
    await seedDefaultLocales();
  } catch (e) {
    logger.warn({ err: e }, "Failed to auto-seed locales");
  }

  registerAllWorkers();

  app.listen(port, async (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    await scheduleRecurringJobs();
    startJobProcessor();
  });
}

process.on("SIGTERM", () => {
  stopJobProcessor();
  stopScheduler();
  process.exit(0);
});

bootstrap();
