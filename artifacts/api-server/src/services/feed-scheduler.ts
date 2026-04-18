import { and, eq, lte, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { productFeeds } from "@workspace/db/schema";
import { runFeedGeneration } from "./feed-generator";
import { logger } from "../lib/logger";

// Called by cron every hour — picks feeds whose nextRunAt is due
export async function scheduledFeedRun(): Promise<void> {
  const now = new Date();

  const due = await db
    .select({ id: productFeeds.id, name: productFeeds.name, refreshInterval: productFeeds.refreshInterval })
    .from(productFeeds)
    .where(
      and(
        inArray(productFeeds.refreshInterval, ["hourly", "daily"]),
        inArray(productFeeds.status, ["active", "inactive", "error"]),
        lte(productFeeds.nextRunAt, now),
      ),
    );

  if (due.length === 0) return;

  logger.info({ count: due.length }, "Feed scheduler: generating due feeds");

  for (const feed of due) {
    try {
      await runFeedGeneration(feed.id);
      // Schedule next run
      const next = new Date();
      if (feed.refreshInterval === "hourly") {
        next.setHours(next.getHours() + 1);
      } else {
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0); // midnight
      }
      await db.update(productFeeds).set({ nextRunAt: next }).where(eq(productFeeds.id, feed.id));
    } catch (err) {
      logger.error({ err, feedId: feed.id, feedName: feed.name }, "Feed scheduler: generation failed");
    }
  }
}

// Call this when a feed's refreshInterval is first set to schedule it
export async function scheduleFirstRun(feedId: number, interval: string): Promise<void> {
  const next = new Date();
  if (interval === "hourly") {
    next.setHours(next.getHours() + 1);
  } else if (interval === "daily") {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  } else {
    return; // manual — don't schedule
  }
  await db.update(productFeeds).set({ nextRunAt: next }).where(eq(productFeeds.id, feedId));
}
