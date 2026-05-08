import { db } from "@workspace/db";
import {
  trackingEvents,
  trackingSessions,
  type TrackingEventType,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

interface ServerEventInput {
  sessionId: string | null | undefined;
  userId: number | null;
  eventType: TrackingEventType;
  pagePath?: string;
  metadata?: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordServerEvent(input: ServerEventInput): Promise<void> {
  const sessionId = input.sessionId;
  if (!sessionId || typeof sessionId !== "string" || !UUID_RE.test(sessionId)) return;

  try {
    await db
      .insert(trackingSessions)
      .values({ id: sessionId, userId: input.userId })
      .onConflictDoUpdate({
        target: trackingSessions.id,
        set: {
          lastSeenAt: sql`NOW()`,
          userId: sql`COALESCE(${trackingSessions.userId}, EXCLUDED.user_id)`,
        },
      });

    await db.insert(trackingEvents).values({
      sessionId,
      userId: input.userId,
      eventType: input.eventType,
      pagePath: input.pagePath ?? null,
      metadata: input.metadata ?? null,
      occurredAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err, sessionId, eventType: input.eventType }, "recordServerEvent failed");
  }
}
