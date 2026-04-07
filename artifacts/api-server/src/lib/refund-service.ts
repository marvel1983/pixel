import { db } from "@workspace/db";
import { refunds, orders, users } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { processProviderRefund } from "../services/refund";
import { renderAndSendTemplate } from "./email/render-template";
import { logger } from "./logger";

export async function processRefund(refundId: number): Promise<{ success: boolean; error?: string }> {
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId));
  if (!refund) return { success: false, error: "Refund not found" };

  const [order] = await db.select().from(orders).where(eq(orders.id, refund.orderId));
  if (!order) return { success: false, error: "Order not found" };

  await db.update(refunds).set({ status: "PROCESSING" }).where(eq(refunds.id, refundId));

  try {
    const providerResult = await processProviderRefund({
      paymentIntentId: order.paymentIntentId ?? "",
      amount: refund.amountUsd,
      reason: refund.reason,
    });

    if (!providerResult.success) {
      await db.update(refunds).set({
        status: "FAILED",
        failureReason: providerResult.error ?? "Provider refund failed",
      }).where(eq(refunds.id, refundId));
      return { success: false, error: providerResult.error };
    }

    await db.update(refunds).set({
      status: "COMPLETED",
      externalRefundId: providerResult.refundId,
      processedAt: new Date(),
      failureReason: null,
    }).where(eq(refunds.id, refundId));

    await updateOrderRefundStatus(refund.orderId);

    if (refund.notifyCustomer && order.guestEmail) {
      const customerName = order.guestEmail.split("@")[0];
      await renderAndSendTemplate("refund_confirmation", order.guestEmail, {
        orderNumber: order.orderNumber,
        customerName,
        refundAmount: `$${refund.amountUsd}`,
        reason: refund.reason,
      });
    }

    logger.info({ refundId, externalId: providerResult.refundId }, "Refund processed successfully");
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
