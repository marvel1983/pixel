import { Router } from "express";
import { db } from "@workspace/db";
import { metenziWebhookEvents, orders } from "@workspace/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();

const PAGE_SIZE = 50;

router.get("/admin/metenzi/webhook-events", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const eventType = typeof req.query.eventType === "string" ? req.query.eventType.trim() : "";
  const successFilter = typeof req.query.success === "string" ? req.query.success.trim() : "";
  const metenziOrderId = typeof req.query.metenziOrderId === "string" ? req.query.metenziOrderId.trim() : "";

  const conditions = [];
  if (eventType) conditions.push(eq(metenziWebhookEvents.eventType, eventType));
  if (metenziOrderId) conditions.push(eq(metenziWebhookEvents.metenziOrderId, metenziOrderId));
  if (successFilter === "true") conditions.push(eq(metenziWebhookEvents.success, true));
  if (successFilter === "false") conditions.push(eq(metenziWebhookEvents.success, false));
  if (successFilter === "pending") conditions.push(sql`${metenziWebhookEvents.processedAt} IS NULL`);

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(metenziWebhookEvents).where(where);

  const rows = await db
    .select({
      id: metenziWebhookEvents.id,
      eventType: metenziWebhookEvents.eventType,
      metenziOrderId: metenziWebhookEvents.metenziOrderId,
      relatedOrderId: metenziWebhookEvents.relatedOrderId,
      receivedAt: metenziWebhookEvents.receivedAt,
      processedAt: metenziWebhookEvents.processedAt,
      success: metenziWebhookEvents.success,
      outcomeNote: metenziWebhookEvents.outcomeNote,
      errorMsg: metenziWebhookEvents.errorMsg,
      orderNumber: orders.orderNumber,
    })
    .from(metenziWebhookEvents)
    .leftJoin(orders, eq(orders.id, metenziWebhookEvents.relatedOrderId))
    .where(where)
    .orderBy(desc(metenziWebhookEvents.receivedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  res.json({
    events: rows,
    page,
    pageSize: PAGE_SIZE,
    total: Number(total),
    totalPages: Math.ceil(Number(total) / PAGE_SIZE),
  });
});

router.get("/admin/metenzi/webhook-events/:id", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = Number(paramString(req.params, "id"));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid event ID" }); return; }
  const [row] = await db
    .select({
      event: metenziWebhookEvents,
      orderNumber: orders.orderNumber,
    })
    .from(metenziWebhookEvents)
    .leftJoin(orders, eq(orders.id, metenziWebhookEvents.relatedOrderId))
    .where(eq(metenziWebhookEvents.id, id));
  if (!row) { res.status(404).json({ error: "Event not found" }); return; }
  res.json({ ...row.event, orderNumber: row.orderNumber });
});

export default router;
