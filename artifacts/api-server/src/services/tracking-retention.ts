import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const EVENT_RETENTION_DAYS = 180;
const SNAPSHOT_RETENTION_DAYS = 180;
const ANON_SESSION_RETENTION_DAYS = 180;
const NAMED_SESSION_RETENTION_DAYS = 365;

interface CleanupResult {
  events: number;
  snapshots: number;
  sessions: number;
}

export async function cleanupExpiredTracking(): Promise<CleanupResult> {
  const evRes = await db.execute(
    sql`DELETE FROM tracking_events WHERE occurred_at < NOW() - (${EVENT_RETENTION_DAYS} || ' days')::interval`,
  );
  const snRes = await db.execute(
    sql`DELETE FROM cart_state_snapshots WHERE captured_at < NOW() - (${SNAPSHOT_RETENTION_DAYS} || ' days')::interval`,
  );
  const seRes = await db.execute(sql`
    DELETE FROM tracking_sessions
    WHERE (user_id IS NULL AND last_seen_at < NOW() - (${ANON_SESSION_RETENTION_DAYS} || ' days')::interval)
       OR (user_id IS NOT NULL AND last_seen_at < NOW() - (${NAMED_SESSION_RETENTION_DAYS} || ' days')::interval)
  `);
  const result = {
    events: evRes.rowCount ?? 0,
    snapshots: snRes.rowCount ?? 0,
    sessions: seRes.rowCount ?? 0,
  };
  if (result.events > 0 || result.snapshots > 0 || result.sessions > 0) {
    logger.info(result, "Tracking retention cleanup ran");
  }
  return result;
}

interface AnonymizeResult {
  sessions: number;
  events: number;
  snapshots: number;
}

export async function anonymizeUserTracking(userId: number): Promise<AnonymizeResult> {
  const seRes = await db.execute(sql`
    UPDATE tracking_sessions
    SET user_id = NULL, ip_address = NULL, user_agent = NULL,
        utm_source = NULL, utm_medium = NULL, utm_campaign = NULL, referrer = NULL
    WHERE user_id = ${userId}
  `);
  const evRes = await db.execute(sql`
    UPDATE tracking_events SET user_id = NULL WHERE user_id = ${userId}
  `);
  const snRes = await db.execute(sql`
    UPDATE cart_state_snapshots SET user_id = NULL WHERE user_id = ${userId}
  `);
  return {
    sessions: seRes.rowCount ?? 0,
    events: evRes.rowCount ?? 0,
    snapshots: snRes.rowCount ?? 0,
  };
}
