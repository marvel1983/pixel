import { db } from "@workspace/db";
import {
  trackingSessions,
  trackingEvents,
  cartStateSnapshots,
  TRACKING_EVENT_TYPES,
  type TrackingEventType,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import type { CartSnapshotItem } from "@workspace/db/schema";
import type { CartSnapshotTotals } from "@workspace/db/schema";

export interface IngestEvent {
  eventType: TrackingEventType;
  occurredAt: string;
  pagePath?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface IngestSnapshot {
  triggerEvent: string;
  capturedAt: string;
  items: CartSnapshotItem[];
  totals: CartSnapshotTotals;
}

export interface IngestSessionInit {
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  deviceType?: string | null;
}

export interface IngestPayload {
  sessionId: string;
  userId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  geoCountry: string | null;
  events: IngestEvent[];
  snapshots: IngestSnapshot[];
  sessionInit?: IngestSessionInit;
}

const VALID_TYPES = new Set<string>(TRACKING_EVENT_TYPES);

export async function ingestBatch(p: IngestPayload): Promise<void> {
  await db
    .insert(trackingSessions)
    .values({
      id: p.sessionId,
      userId: p.userId,
      ipAddress: p.ipAddress,
      userAgent: p.userAgent,
      geoCountry: p.geoCountry,
      deviceType: p.sessionInit?.deviceType ?? null,
      referrer: p.sessionInit?.referrer ?? null,
      utmSource: p.sessionInit?.utmSource ?? null,
      utmMedium: p.sessionInit?.utmMedium ?? null,
      utmCampaign: p.sessionInit?.utmCampaign ?? null,
    })
    .onConflictDoUpdate({
      target: trackingSessions.id,
      set: {
        lastSeenAt: sql`NOW()`,
        userId: sql`COALESCE(${trackingSessions.userId}, EXCLUDED.user_id)`,
      },
    });

  if (p.events.length > 0) {
    const rows = p.events
      .filter((e) => VALID_TYPES.has(e.eventType))
      .map((e) => ({
        sessionId: p.sessionId,
        userId: p.userId,
        eventType: e.eventType,
        pagePath: e.pagePath ?? null,
        metadata: e.metadata ?? null,
        occurredAt: new Date(e.occurredAt),
      }));
    if (rows.length > 0) await db.insert(trackingEvents).values(rows);
  }

  if (p.snapshots.length > 0) {
    const rows = p.snapshots.map((s) => ({
      sessionId: p.sessionId,
      userId: p.userId,
      triggerEvent: s.triggerEvent,
      items: s.items,
      totals: s.totals,
      capturedAt: new Date(s.capturedAt),
    }));
    await db.insert(cartStateSnapshots).values(rows);
  }
}
