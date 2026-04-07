import { db } from "@workspace/db";
import { refunds, orders } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./email/mailer";
import { logger } from "./logger";
import crypto from "crypto";

export async function processRefund(refundId: number): Promise<{ success: boolean; error?: string }> {
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
  if (!refund) return { success: false, error: "Refund not found" };

  await db.update(refunds).set({ status: "PROCESSING" }).where(eq(refunds.id, refundId));

  try {
    const externalId = `rf_${crypto.randomBytes(8).toString("hex")}`;

    await db.update(refunds).set({
      status: "COMPLETED",
      externalRefundId: externalId,
      processedAt: new Date(),
      failureReason: null,
    }).where(eq(refunds.id, refundId));

    await updateOrderRefundStatus(refund.orderId);

    if (refund.notifyCustomer) {
      await sendRefundNotification(refund.orderId, refund.amountUsd, refund.reason);
    }

    logger.info({ refundId, externalId }, "Refund processed successfully");
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown processing error";
    await db.update(refunds).set({
      status: "FAILED",
      failureReason: errorMsg,
    }).where(eq(refunds.id, refundId));

    logger.error({ refundId, err }, "Refund processing failed");
    return { success: false, error: errorMsg };
  }
}

export async function updateOrderRefundStatus(orderId: number): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;

  const allRefunds = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const completedTotal = allRefunds
    .filter((r) => r.status === "COMPLETED")
    .reduce((sum, r) => sum + parseFloat(r.amountUsd), 0);

  const orderTotal = parseFloat(order.totalUsd);

  let newStatus: string;
  if (completedTotal >= orderTotal - 0.01) {
    newStatus = "REFUNDED";
  } else if (completedTotal > 0) {
    newStatus = "PARTIALLY_REFUNDED";
  } else {
    return;
  }

  await db.update(orders).set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function sendRefundNotification(orderId: number, amountUsd: string, reason: string): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order?.guestEmail) return;

  const subject = `Refund Processed — Order ${order.orderNumber}`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#2563eb;">Refund Confirmation</h2>
      <p>A refund of <strong>$${amountUsd}</strong> has been processed for your order <strong>${order.orderNumber}</strong>.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>The refund should appear in your account within 5–10 business days depending on your payment provider.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="color:#6b7280;font-size:13px;">If you have any questions, please contact our support team.</p>
    </div>
  `;

  try {
    await sendEmail(order.guestEmail, subject, html);
  } catch (err) {
    logger.warn({ orderId, err }, "Failed to send refund notification email");
  }
}
