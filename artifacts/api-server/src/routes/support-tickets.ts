import { Router } from "express";
import { z } from "zod";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { supportTickets, ticketMessages, ticketStatusHistory, users, orders } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { enqueueEmail } from "../lib/email/queue";
import { logger } from "../lib/logger";

const router = Router();

async function nextTicketNumber(): Promise<string> {
  const [row] = await db.select({
    maxNum: sql<string>`COALESCE(MAX(CAST(SUBSTRING(${supportTickets.ticketNumber} FROM 5) AS integer)), 0)`,
  }).from(supportTickets);
  const seq = (parseInt(row?.maxNum ?? "0") || 0) + 1;
  return `TKT-${String(seq).padStart(5, "0")}`;
}

function isDbUniqueError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

const createSchema = z.object({
  subject: z.string().min(1).max(300),
  category: z.enum(["ORDER_ISSUE", "KEY_PROBLEM", "PAYMENT", "REFUND", "ACCOUNT", "TECHNICAL", "OTHER"]),
  message: z.string().min(1).max(5000),
  orderId: z.number().int().optional(),
});

router.post("/support/tickets", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid data" }); return; }
  const { subject, category, message, orderId } = parsed.data;
  const userId = req.user!.userId;

  try {
    if (orderId) {
      const [ownOrder] = await db.select({ id: orders.id }).from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
      if (!ownOrder) { res.status(403).json({ error: "Order not found or not yours" }); return; }
    }

    let ticketNumber = await nextTicketNumber();
    let retries = 3;
    let ticket;
    while (retries > 0) {
      try {
        const [row] = await db.insert(supportTickets).values({
          ticketNumber, userId, subject, category, orderId: orderId ?? null,
        }).returning();
        ticket = row;
        break;
      } catch (err: unknown) {
        if (isDbUniqueError(err) && retries > 1) {
          ticketNumber = await nextTicketNumber();
          retries--;
          continue;
        }
        throw err;
      }
    }
    if (!ticket) throw new Error("Failed to generate unique ticket number");

    await db.insert(ticketMessages).values({
      ticketId: ticket.id, senderId: userId, isStaff: false, isInternal: false, body: message,
    });

    await db.insert(ticketStatusHistory).values({
      ticketId: ticket.id, fromStatus: null, toStatus: "OPEN", changedById: userId,
      note: "Ticket created",
    });

    try {
      const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, "ADMIN"));
      for (const admin of admins) {
        await enqueueEmail(admin.email, `New Support Ticket: ${ticketNumber}`,
          `<h2>New Support Ticket</h2><p><strong>${ticketNumber}</strong> - ${subject}</p><p>Category: ${category}</p><p>${message.substring(0, 500)}</p>`);
      }
    } catch (emailErr) { logger.error(emailErr, "Failed to enqueue ticket notification"); }

    res.status(201).json(ticket);
  } catch (err) {
    logger.error(err, "Failed to create ticket");
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.get("/support/tickets", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const status = req.query.status as string | undefined;

  const conditions = [eq(supportTickets.userId, userId)];
  if (status && status !== "ALL") {
    conditions.push(eq(supportTickets.status, status as "OPEN"));
  }

  const tickets = await db.select({
    id: supportTickets.id, ticketNumber: supportTickets.ticketNumber,
    subject: supportTickets.subject, status: supportTickets.status,
    priority: supportTickets.priority, category: supportTickets.category,
    createdAt: supportTickets.createdAt, updatedAt: supportTickets.updatedAt,
  }).from(supportTickets)
    .where(and(...conditions))
    .orderBy(desc(supportTickets.createdAt))
    .limit(50);

  res.json(tickets);
});

router.get("/support/tickets/:ticketNumber", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [ticket] = await db.select().from(supportTickets)
    .where(and(eq(supportTickets.ticketNumber, req.params.ticketNumber), eq(supportTickets.userId, userId)))
    .limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const messages = await db.select({
    id: ticketMessages.id, body: ticketMessages.body, isStaff: ticketMessages.isStaff,
    createdAt: ticketMessages.createdAt,
    senderName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
  }).from(ticketMessages)
    .leftJoin(users, eq(ticketMessages.senderId, users.id))
    .where(and(eq(ticketMessages.ticketId, ticket.id), eq(ticketMessages.isInternal, false)))
    .orderBy(ticketMessages.createdAt);

  const timeline = await db.select().from(ticketStatusHistory)
    .where(eq(ticketStatusHistory.ticketId, ticket.id))
    .orderBy(ticketStatusHistory.createdAt);

  res.json({ ticket, messages, timeline });
});

const replySchema = z.object({ message: z.string().min(1).max(5000) });

router.post("/support/tickets/:ticketNumber/reply", requireAuth, async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid message" }); return; }
  const userId = req.user!.userId;

  const [ticket] = await db.select().from(supportTickets)
    .where(and(eq(supportTickets.ticketNumber, req.params.ticketNumber), eq(supportTickets.userId, userId)))
    .limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const [msg] = await db.insert(ticketMessages).values({
    ticketId: ticket.id, senderId: userId, isStaff: false, isInternal: false, body: parsed.data.message,
  }).returning();

  const oldStatus = ticket.status;
  await db.update(supportTickets).set({ status: "OPEN", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
  if (oldStatus !== "OPEN") {
    await db.insert(ticketStatusHistory).values({
      ticketId: ticket.id, fromStatus: oldStatus, toStatus: "OPEN", changedById: userId,
      note: "Customer replied",
    });
  }

  try {
    if (ticket.assigneeId) {
      const [assignee] = await db.select({ email: users.email }).from(users).where(eq(users.id, ticket.assigneeId));
      if (assignee) {
        await enqueueEmail(assignee.email, `Customer Reply: ${ticket.ticketNumber}`,
          `<h2>Customer Reply</h2><p>Ticket <strong>${ticket.ticketNumber}</strong> has a new customer reply.</p><p>${parsed.data.message.substring(0, 500)}</p>`);
      }
    } else {
      const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, "ADMIN"));
      for (const admin of admins) {
        await enqueueEmail(admin.email, `Customer Reply: ${ticket.ticketNumber}`,
          `<h2>Customer Reply (Unassigned)</h2><p>Ticket <strong>${ticket.ticketNumber}</strong> has a new customer reply.</p><p>${parsed.data.message.substring(0, 500)}</p>`);
      }
    }
  } catch (emailErr) { logger.error(emailErr, "Failed to enqueue reply notification"); }

  res.json(msg);
});

router.post("/support/tickets/:ticketNumber/resolve", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [ticket] = await db.select().from(supportTickets)
    .where(and(eq(supportTickets.ticketNumber, req.params.ticketNumber), eq(supportTickets.userId, userId)))
    .limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await db.update(supportTickets).set({ status: "RESOLVED", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket.id, fromStatus: ticket.status, toStatus: "RESOLVED", changedById: userId,
    note: "Customer resolved ticket",
  });
  res.json({ success: true });
});

router.post("/support/tickets/:ticketNumber/reopen", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [ticket] = await db.select().from(supportTickets)
    .where(and(eq(supportTickets.ticketNumber, req.params.ticketNumber), eq(supportTickets.userId, userId)))
    .limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await db.update(supportTickets).set({ status: "OPEN", updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
  await db.insert(ticketStatusHistory).values({
    ticketId: ticket.id, fromStatus: ticket.status, toStatus: "OPEN", changedById: userId,
    note: "Customer reopened ticket",
  });
  res.json({ success: true });
});

export default router;
