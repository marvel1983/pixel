import { Router } from "express";
import { db } from "@workspace/db";
import { refunds, orders, users } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, gte, lte, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import crypto from "crypto";

const router = Router();

router.get("/admin/refunds", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { status, search, from, to, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status && status !== "ALL") conditions.push(eq(refunds.status, status as any));
  if (from) conditions.push(gte(refunds.createdAt, new Date(from as string)));
  if (to) conditions.push(lte(refunds.createdAt, new Date(to as string)));
  if (search) {
    conditions.push(or(
      ilike(orders.orderNumber, `%${search}%`),
      ilike(orders.guestEmail, `%${search}%`),
    ));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: refunds.id, orderId: refunds.orderId, amountUsd: refunds.amountUsd,
      reason: refunds.reason, notes: refunds.notes, status: refunds.status,
      externalRefundId: refunds.externalRefundId, failureReason: refunds.failureReason,
      notifyCustomer: refunds.notifyCustomer, createdAt: refunds.createdAt,
      processedAt: refunds.processedAt,
      orderNumber: orders.orderNumber, orderTotal: orders.totalUsd,
      customerEmail: orders.guestEmail,
      adminEmail: users.email, adminFirst: users.firstName,
    })
    .from(refunds)
    .innerJoin(orders, eq(refunds.orderId, orders.id))
    .innerJoin(users, eq(refunds.initiatedBy, users.id))
    .where(where)
    .orderBy(desc(refunds.createdAt))
    .limit(limit).offset(offset);

  const [{ total: totalCount }] = await db
    .select({ total: count() })
    .from(refunds)
    .innerJoin(orders, eq(refunds.orderId, orders.id))
    .where(where);

  res.json({ refunds: rows, total: totalCount, page, limit });
});

router.get("/admin/refunds/order/:orderId", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  const orderRefunds = await db.select().from(refunds)
    .where(eq(refunds.orderId, orderId)).orderBy(desc(refunds.createdAt));
  const refundedTotal = orderRefunds
    .filter((r) => r.status === "COMPLETED" || r.status === "PROCESSING" || r.status === "PENDING")
    .reduce((sum, r) => sum + parseFloat(r.amountUsd), 0);
  res.json({ refunds: orderRefunds, refundedTotal });
});

router.post("/admin/refunds", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { orderId, amount, reason, notes, notifyCustomer } = req.body;
  if (!orderId || !amount || !reason) {
    res.status(400).json({ error: "orderId, amount, and reason are required" }); return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const existingRefunds = await db.select().from(refunds)
    .where(eq(refunds.orderId, orderId));
  const refundedTotal = existingRefunds
    .filter((r) => r.status !== "FAILED")
    .reduce((sum, r) => sum + parseFloat(r.amountUsd), 0);
  const maxRefundable = parseFloat(order.totalUsd) - refundedTotal;

  if (parseFloat(amount) > maxRefundable + 0.01) {
    res.status(400).json({ error: `Maximum refundable amount is $${maxRefundable.toFixed(2)}` }); return;
  }

  const externalRefundId = `rf_${crypto.randomBytes(8).toString("hex")}`;

  const [refund] = await db.insert(refunds).values({
    orderId, initiatedBy: req.user!.userId,
    amountUsd: parseFloat(amount).toFixed(2),
    reason, notes: notes || null,
    notifyCustomer: notifyCustomer ?? true,
    status: "PROCESSING", externalRefundId,
  }).returning();

  await db.update(refunds).set({ status: "COMPLETED", processedAt: new Date() })
    .where(eq(refunds.id, refund.id));

  const updatedRefunded = refundedTotal + parseFloat(amount);
  const orderTotal = parseFloat(order.totalUsd);
  const newStatus = updatedRefunded >= orderTotal - 0.01 ? "REFUNDED" : "PARTIALLY_REFUNDED";
  await db.update(orders).set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  res.json({ success: true, refund: { ...refund, status: "COMPLETED" } });
});

router.post("/admin/refunds/:id/retry", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, id));
  if (!refund) { res.status(404).json({ error: "Refund not found" }); return; }
  if (refund.status !== "FAILED") {
    res.status(400).json({ error: "Only failed refunds can be retried" }); return;
  }

  const newExternalId = `rf_${crypto.randomBytes(8).toString("hex")}`;
  await db.update(refunds).set({
    status: "COMPLETED", externalRefundId: newExternalId,
    failureReason: null, processedAt: new Date(),
  }).where(eq(refunds.id, id));

  const [order] = await db.select().from(orders).where(eq(orders.id, refund.orderId));
  if (order) {
    const allRefunds = await db.select().from(refunds).where(eq(refunds.orderId, refund.orderId));
    const total = allRefunds.filter((r) => r.status !== "FAILED")
      .reduce((s, r) => s + parseFloat(r.amountUsd), 0) + parseFloat(refund.amountUsd);
    const newStatus = total >= parseFloat(order.totalUsd) - 0.01 ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await db.update(orders).set({ status: newStatus, updatedAt: new Date() })
      .where(eq(orders.id, refund.orderId));
  }

  res.json({ success: true });
});

export default router;
