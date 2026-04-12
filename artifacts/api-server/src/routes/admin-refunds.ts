import { Router } from "express";
import { db } from "@workspace/db";
import { refunds, orders, users } from "@workspace/db/schema";
import { eq, desc, and, or, ilike, gte, lte, count } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { processRefund, processWalletRefund, updateOrderRefundStatus } from "../lib/refund-service";
import { paramString } from "../lib/route-params";

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
  if (from) {
    const fromDate = new Date(from as string);
    if (!isNaN(fromDate.getTime())) conditions.push(gte(refunds.createdAt, fromDate));
  }
  if (to) {
    const toDate = new Date(to as string);
    if (!isNaN(toDate.getTime())) conditions.push(lte(refunds.createdAt, toDate));
  }
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
  const orderId = parseInt(paramString(req.params, "orderId"));
  const orderRefunds = await db.select().from(refunds)
    .where(eq(refunds.orderId, orderId)).orderBy(desc(refunds.createdAt));
  const refundedTotal = orderRefunds
    .filter((r) => r.status === "COMPLETED" || r.status === "PROCESSING" || r.status === "PENDING")
    .reduce((sum, r) => sum + parseFloat(r.amountUsd), 0);
  res.json({ refunds: orderRefunds, refundedTotal });
});

router.post("/admin/refunds", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { orderId, amount, reason, notes, notifyCustomer, refundToWallet } = req.body;
  if (!orderId || !amount || !reason) {
    res.status(400).json({ error: "orderId, amount, and reason are required" }); return;
  }
  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" }); return;
  }
  const roundedAmount = Math.round(parsedAmount * 100) / 100;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  const existingRefunds = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const refundedTotal = existingRefunds.filter((r) => r.status !== "FAILED").reduce((sum, r) => sum + parseFloat(r.amountUsd), 0);
  const maxRefundable = parseFloat(order.totalUsd) - refundedTotal;
  if (roundedAmount > maxRefundable + 0.01) {
    res.status(400).json({ error: `Maximum refundable amount is $${maxRefundable.toFixed(2)}` }); return;
  }

  if (refundToWallet) {
    const userId = order.userId ?? (order.guestEmail
      ? (await db.select({ id: users.id }).from(users).where(eq(users.email, order.guestEmail)).limit(1))[0]?.id
      : undefined);
    if (!userId) { res.status(400).json({ error: "No user account found for wallet refund" }); return; }
    const [refund] = await db.insert(refunds).values({
      orderId, initiatedBy: req.user!.userId, amountUsd: roundedAmount.toFixed(2),
      reason, notes: `[Wallet Refund] ${notes || ""}`.trim(), notifyCustomer: notifyCustomer ?? true, status: "PENDING",
    }).returning();
    const result = await processWalletRefund(refund.id, userId);
    const [updated] = await db.select().from(refunds).where(eq(refunds.id, refund.id));
    if (!result.success) { res.status(500).json({ error: result.error, refund: updated }); return; }
    res.json({ success: true, refund: updated });
    return;
  }

  const [refund] = await db.insert(refunds).values({
    orderId, initiatedBy: req.user!.userId, amountUsd: roundedAmount.toFixed(2),
    reason, notes: notes || null, notifyCustomer: notifyCustomer ?? true, status: "PENDING",
  }).returning();
  const result = await processRefund(refund.id);
  const [updated] = await db.select().from(refunds).where(eq(refunds.id, refund.id));
  if (!result.success) { res.status(500).json({ error: result.error, refund: updated }); return; }
  res.json({ success: true, refund: updated });
});

router.post("/admin/refunds/:id/retry", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
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
