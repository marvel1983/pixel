import { Router } from "express";
import { db } from "@workspace/db";
import {
  trackingSessions,
  trackingEvents,
  cartStateSnapshots,
  orders,
} from "@workspace/db/schema";
import { eq, desc, asc, count, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();

const SESSION_LIMIT = 50;
const EVENT_LIMIT = 500;
const SNAPSHOT_LIMIT = 50;

router.get(
  "/admin/customers/:id/sessions",
  requireAuth,
  requireAdmin,
  requirePermission("manageCustomers"),
  async (req, res) => {
    const customerId = Number(paramString(req.params, "id"));
    if (!Number.isFinite(customerId) || customerId <= 0) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }

    const sessionRows = await db
      .select({
        id: trackingSessions.id,
        ipAddress: trackingSessions.ipAddress,
        deviceType: trackingSessions.deviceType,
        geoCountry: trackingSessions.geoCountry,
        referrer: trackingSessions.referrer,
        utmSource: trackingSessions.utmSource,
        utmMedium: trackingSessions.utmMedium,
        utmCampaign: trackingSessions.utmCampaign,
        startedAt: trackingSessions.startedAt,
        lastSeenAt: trackingSessions.lastSeenAt,
      })
      .from(trackingSessions)
      .where(eq(trackingSessions.userId, customerId))
      .orderBy(desc(trackingSessions.lastSeenAt))
      .limit(SESSION_LIMIT);

    if (sessionRows.length === 0) {
      res.json({ sessions: [] });
      return;
    }

    const ids = sessionRows.map((s) => s.id);
    const eventCounts = await db
      .select({ sessionId: trackingEvents.sessionId, c: count() })
      .from(trackingEvents)
      .where(inArray(trackingEvents.sessionId, ids))
      .groupBy(trackingEvents.sessionId);
    const countBySession = new Map(eventCounts.map((r) => [r.sessionId, Number(r.c)]));

    const linkedOrders = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, sessionId: orders.sessionId })
      .from(orders)
      .where(inArray(orders.sessionId, ids));
    const orderBySession = new Map(linkedOrders.map((o) => [o.sessionId!, { id: o.id, orderNumber: o.orderNumber }]));

    const sessions = sessionRows.map((s) => ({
      ...s,
      eventCount: countBySession.get(s.id) ?? 0,
      order: orderBySession.get(s.id) ?? null,
    }));

    res.json({ sessions });
  },
);

router.get(
  "/admin/sessions/:id/journey",
  requireAuth,
  requireAdmin,
  requirePermission("manageCustomers"),
  async (req, res) => {
    const sessionId = paramString(req.params, "id");
    if (!sessionId) {
      res.status(400).json({ error: "Invalid session id" });
      return;
    }

    const [session] = await db
      .select()
      .from(trackingSessions)
      .where(eq(trackingSessions.id, sessionId));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const events = await db
      .select({
        id: trackingEvents.id,
        eventType: trackingEvents.eventType,
        pagePath: trackingEvents.pagePath,
        metadata: trackingEvents.metadata,
        occurredAt: trackingEvents.occurredAt,
      })
      .from(trackingEvents)
      .where(eq(trackingEvents.sessionId, sessionId))
      .orderBy(asc(trackingEvents.occurredAt))
      .limit(EVENT_LIMIT);

    const snapshots = await db
      .select({
        id: cartStateSnapshots.id,
        triggerEvent: cartStateSnapshots.triggerEvent,
        items: cartStateSnapshots.items,
        totals: cartStateSnapshots.totals,
        capturedAt: cartStateSnapshots.capturedAt,
      })
      .from(cartStateSnapshots)
      .where(eq(cartStateSnapshots.sessionId, sessionId))
      .orderBy(asc(cartStateSnapshots.capturedAt))
      .limit(SNAPSHOT_LIMIT);

    res.json({ session, events, snapshots });
  },
);

export default router;
