import { Router } from "express";
import { z } from "zod";
import { eq, desc, and, sql, count, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import { supportTickets, ticketMessages, users, orders } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { enqueueEmail } from "../lib/email/queue";
import { logger } from "../lib/logger";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageCustomers")];

router.get("/admin/support/stats", ...auth, async (_req, res) => {
  const [open] = await db.select({ c: count() }).from(supportTickets).where(eq(supportTickets.status, "OPEN"));
  const [inProg] = await db.select({ c: count() }).from(supportTickets).where(eq(supportTickets.status, "IN_PROGRESS"));
  const [waiting] = await db.select({ c: count() }).from(supportTickets).where(eq(supportTickets.status, "AWAITING_CUSTOMER"));
  const [resolved] = await db.select({ c: count() }).from(supportTickets).where(eq(supportTickets.status, "RESOLVED"));

  const [avgRes] = await db.select({
    avg: sql<string>`COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (${supportTickets.updatedAt} - ${supportTickets.createdAt})) / 3600)::numeric, 1), 0)`,
  }).from(supportTickets).where(eq(supportTickets.status, "RESOLVED"));

  res.json({
    open: open?.c ?? 0, inProgress: inProg?.c ?? 0,
    waiting: waiting?.c ?? 0, resolved: resolved?.c ?? 0,
    avgResponseHours: parseFloat(avgRes?.avg ?? "0"),
  });
});

router.get("/admin/support/tickets", ...auth, async (req, res) => {
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const conditions = [];
  if (status && status !== "ALL") conditions.push(eq(supportTickets.status, status as "OPEN"));
  if (priority && priority !== "ALL") conditions.push(eq(supportTickets.priority, priority as "LOW"));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const tickets = await db.select({
    id: supportTickets.id, ticketNumber: supportTickets.ticketNumber,
    subject: supportTickets.subject, status: supportTickets.status,
    priority: supportTickets.priority, category: supportTickets.category,
    createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
    customerEmail: sql<string>`COALESCE(${users.email}, 'Unknown')`,
    customerName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
  }).from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(where)
    .orderBy(desc(supportTickets.updatedAt))
    .limit(limit).offset((page - 1) * limit);

  const [total] = await db.select({ c: count() }).from(supportTickets).where(where);
  res.json({ tickets, total: total?.c ?? 0, page, limit });
});

router.get("/admin/support/tickets/:ticketNumber", ...auth, async (req, res) => {
  const [ticket] = await db.select({
    id: supportTickets.id, ticketNumber: supportTickets.ticketNumber,
    subject: supportTickets.subject, status: supportTickets.status,
    priority: supportTickets.priority, category: supportTickets.category,
    orderId: supportTickets.orderId, userId: supportTickets.userId,
    assigneeId: supportTickets.assigneeId,
    createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
    customerEmail: sql<string>`COALESCE(${users.email}, 'Unknown')`,
    customerName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
  }).from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(eq(supportTickets.ticketNumber, req.params.ticketNumber)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

  const messages = await db.select({
    id: ticketMessages.id, body: ticketMessages.body, isStaff: ticketMessages.isStaff,
    isInternal: ticketMessages.isInternal, createdAt: ticketMessages.createdAt,
    senderName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
  }).from(ticketMessages)
    .leftJoin(users, eq(ticketMessages.senderId, users.id))
    .where(eq(ticketMessages.ticketId, ticket.id))
    .orderBy(ticketMessages.createdAt);

  let order = null;
  if (ticket.orderId) {
    const [o] = await db.select({ orderNumber: orders.orderNumber, totalUsd: orders.totalUsd, status: orders.status })
      .from(orders).where(eq(orders.id, ticket.orderId)).limit(1);
    order = o ?? null;
  }

  const assignee = ticket.assigneeId
    ? (await db.select({ firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users).where(eq(users.id, ticket.assigneeId)).limit(1))[0] ?? null
    : null;

  res.json({ ticket, messages, order, assignee });
});

const replySchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
});

router.post("/admin/support/tickets/:ticketNumber/reply", ...auth, async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { message, isInternal, status } = parsed.data;

  const [ticket] = await db.select().from(supportTickets)
    .where(eq(supportTickets.ticketNumber, req.params.ticketNumber)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

  const [msg] = await db.insert(ticketMessages).values({
    ticketId: ticket.id, senderId: req.user!.userId,
    isStaff: true, isInternal: isInternal ?? false, body: message,
  }).returning();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (status) updates.status = status;
  else if (!isInternal) updates.status = "AWAITING_CUSTOMER";
  await db.update(supportTickets).set(updates).where(eq(supportTickets.id, ticket.id));

  if (!isInternal && ticket.userId) {
    try {
      const [customer] = await db.select({ email: users.email }).from(users).where(eq(users.id, ticket.userId));
      if (customer) {
        await enqueueEmail(customer.email, `Reply to Your Ticket: ${ticket.ticketNumber}`,
          `<h2>Support Update</h2><p>Your ticket <strong>${ticket.ticketNumber}</strong> has a new reply.</p><p>${message.substring(0, 500)}</p><p>Log in to view the full conversation.</p>`);
      }
    } catch (e) { logger.error(e, "Failed to enqueue admin reply notification"); }
  }

  res.json(msg);
});

const updateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assigneeId: z.number().int().nullable().optional(),
});

router.patch("/admin/support/tickets/:ticketNumber", ...auth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }

  const [ticket] = await db.select().from(supportTickets)
    .where(eq(supportTickets.ticketNumber, req.params.ticketNumber)).limit(1);
  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.priority) updates.priority = parsed.data.priority;
  if (parsed.data.assigneeId !== undefined) updates.assigneeId = parsed.data.assigneeId;

  await db.update(supportTickets).set(updates).where(eq(supportTickets.id, ticket.id));
  res.json({ success: true });
});

router.get("/admin/support/assignees", ...auth, async (_req, res) => {
  const admins = await db.select({
    id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email,
  }).from(users).where(eq(users.role, "ADMIN"));
  res.json(admins);
});

export default router;
