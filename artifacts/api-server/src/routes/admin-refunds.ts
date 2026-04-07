import { Router } from "express";
import { db } from "@workspace/db";
import { refunds, orders, users } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, gte, lte, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { processRefund, updateOrderRefundStatus } from "../lib/refund-service";

const router = Router();

const VALID_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
type RefundStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string): s is RefundStatus {
  return (VALID_STATUSES as readonly string[]).includes(s);
}

router.get("/admin/refunds", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { status, search, from, to, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (typeof status === "string" && status !== "ALL" && isValidStatus(status)) {
    conditions.push(eq(refunds.status, status));
  }
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

  const [refund] = await db.insert(refunds).values({
    orderId, initiatedBy: req.user!.userId,
    amountUsd: parseFloat(amount).toFixed(2),
    reason, notes: notes || null,
    notifyCustomer: notifyCustomer ?? true,
    status: "PENDING",
  }).returning();

  const result = await processRefund(refund.id);

  const [updated] = await db.select().from(refunds).where(eq(refunds.id, refund.id));

  if (!result.success) {
    res.status(500).json({ error: result.error, refund: updated }); return;
  }

  res.json({ success: true, refund: updated });
});

router.post("/admin/refunds/:id/retry", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, id));
  if (!refund) { res.status(404).json({ error: "Refund not found" }); return; }
  if (refund.status !== "FAILED") {
    res.status(400).json({ error: "Only failed refunds can be retried" }); return;
  }

  await db.update(refunds).set({ status: "PENDING", failureReason: null })
    .where(eq(refunds.id, id));

  const result = await processRefund(id);

  if (!result.success) {
    res.status(500).json({ error: result.error }); return;
  }

  res.json({ success: true });
});

export default router;
