import { Router } from "express";
import { db } from "@workspace/db";
import {
  orders,
  trackingSessions,
  trackingEvents,
  cartStateSnapshots,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();

const EVENT_LIMIT = 500;
const SNAPSHOT_LIMIT = 50;

router.get(
  "/admin/orders/:id/journey",
  requireAuth,
  requireAdmin,
  requirePermission("manageOrders"),
  async (req, res) => {
    const orderId = Number(paramString(req.params, "id"));
    if (!Number.isFinite(orderId) || orderId <= 0) {
      res.status(400).json({ error: "Invalid order id" });
      return;
    }

    const [order] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        sessionId: orders.sessionId,
      })
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!order.sessionId) {
      res.json({
        orderNumber: order.orderNumber,
        session: null,
        events: [],
        snapshots: [],
        message: "No session linked to this order — journey not captured.",
      });
      return;
    }

    const [session] = await db
      .select()
      .from(trackingSessions)
      .where(eq(trackingSessions.id, order.sessionId));

    const events = await db
      .select({
        id: trackingEvents.id,
        eventType: trackingEvents.eventType,
        pagePath: trackingEvents.pagePath,
        metadata: trackingEvents.metadata,
        occurredAt: trackingEvents.occurredAt,
      })
      .from(trackingEvents)
      .where(eq(trackingEvents.sessionId, order.sessionId))
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
      .where(eq(cartStateSnapshots.sessionId, order.sessionId))
      .orderBy(asc(cartStateSnapshots.capturedAt))
      .limit(SNAPSHOT_LIMIT);

    res.json({
      orderNumber: order.orderNumber,
      session,
      events,
      snapshots,
    });
  },
);

export default router;
