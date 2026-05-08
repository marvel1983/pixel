import { Router } from "express";
import { db } from "@workspace/db";
import {
  trackingSessions,
  trackingEvents,
  cartStateSnapshots,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { anonymizeUserTracking } from "../services/tracking-retention";
import { logger } from "../lib/logger";

const router = Router();

const EXPORT_LIMIT = 5000;

router.get("/me/tracking-export", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const sessions = await db
    .select()
    .from(trackingSessions)
    .where(eq(trackingSessions.userId, userId));

  const events = await db
    .select()
    .from(trackingEvents)
    .where(eq(trackingEvents.userId, userId))
    .orderBy(asc(trackingEvents.occurredAt))
    .limit(EXPORT_LIMIT);

  const snapshots = await db
    .select()
    .from(cartStateSnapshots)
    .where(eq(cartStateSnapshots.userId, userId))
    .orderBy(asc(cartStateSnapshots.capturedAt))
    .limit(EXPORT_LIMIT);

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="tracking-export-user-${userId}.json"`,
  );
  res.json({
    exportedAt: new Date().toISOString(),
    userId,
    sessions,
    events,
    snapshots,
    note:
      events.length === EXPORT_LIMIT || snapshots.length === EXPORT_LIMIT
        ? `Export truncated to ${EXPORT_LIMIT} events / snapshots.`
        : undefined,
  });
});

router.delete("/me/tracking-data", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  try {
    const result = await anonymizeUserTracking(userId);
    logger.info({ userId, ...result }, "User tracking data anonymized via DSAR");
    res.json({ anonymized: result });
  } catch (err) {
    logger.error({ err, userId }, "Failed to anonymize user tracking");
    res.status(500).json({ error: "Failed to anonymize tracking data" });
  }
});

export default router;
