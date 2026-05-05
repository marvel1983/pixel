import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, licenseKeys } from "@workspace/db/schema";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getOrderById, confirmPayment } from "../lib/metenzi-endpoints";
import { handleWebhookEvent } from "./webhook-handlers";
import { logger } from "../lib/logger";

const POST_CONFIRM_REFETCH_DELAY_MS = 1500;

export type ForceFulfillOutcome =
  | "delivered"
  | "delivered_after_confirm"
  | "metenzi_no_keys_yet"
  | "metenzi_not_responding"
  | "no_external_order"
  | "no_metenzi_config"
  | "already_fulfilled";

export interface ForceFulfillResult {
  outcome: ForceFulfillOutcome;
  keysProcessed: number;
  totalDelivered: number;
  totalExpected: number;
  metenziStatus?: string;
  confirmPaymentResult?: "ok" | "not_supported" | "error" | "skipped";
  hint?: string;
}

/**
 * Best-effort manual fulfillment trigger.
 *
 * Steps:
 *   1. Re-fetch the Metenzi order. If it now has keys, deliver them.
 *   2. Otherwise call confirmPayment so Metenzi re-runs their gate, then re-fetch
 *      and deliver.
 *   3. If still empty, return "metenzi_no_keys_yet" so the admin UI can suggest
 *      manual key entry.
 */
export async function forceFulfill(orderId: number): Promise<ForceFulfillResult> {
  const [order] = await db
    .select({
      id: orders.id, externalOrderId: orders.externalOrderId, status: orders.status,
    })
    .from(orders).where(eq(orders.id, orderId));
  if (!order) throw new Error("Order not found");

  if (order.status === "COMPLETED") {
    const counts = await getKeyCounts(orderId);
    if (counts.totalExpected === 0 || counts.totalDelivered >= counts.totalExpected) {
      return { outcome: "already_fulfilled", keysProcessed: 0, ...counts };
    }
    // Status is COMPLETED but keys weren't delivered — fall through to attempt fulfillment
  }
  if (!order.externalOrderId) {
    const counts = await getKeyCounts(orderId);
    return {
      outcome: "no_external_order", keysProcessed: 0, ...counts,
      hint: "Order has no Metenzi order ID; use Retry Fulfillment instead.",
    };
  }

  const config = await getMetenziConfig();
  if (!config) {
    const counts = await getKeyCounts(orderId);
    return { outcome: "no_metenzi_config", keysProcessed: 0, ...counts };
  }

  // Step 1: refetch
  const initial = await getOrderById(config, order.externalOrderId);
  if (initial?.keys && initial.keys.length > 0) {
    const processed = await deliver(initial.id, initial.keys.length, initial);
    const counts = await getKeyCounts(orderId);
    return { outcome: "delivered", keysProcessed: processed, ...counts, metenziStatus: initial.status };
  }

  // Step 2: confirm-payment then refetch
  const confirm = await confirmPayment(config, order.externalOrderId);
  logger.info({ orderId, externalOrderId: order.externalOrderId, confirmResult: confirm.result, confirmStatus: confirm.status }, "Force-fulfill: confirmPayment attempt");

  if (confirm.result === "ok") {
    await sleep(POST_CONFIRM_REFETCH_DELAY_MS);
    const refetched = await getOrderById(config, order.externalOrderId);
    if (refetched?.keys && refetched.keys.length > 0) {
      const processed = await deliver(refetched.id, refetched.keys.length, refetched);
      const counts = await getKeyCounts(orderId);
      return {
        outcome: "delivered_after_confirm", keysProcessed: processed,
        ...counts, metenziStatus: refetched.status, confirmPaymentResult: "ok",
      };
    }
    const counts = await getKeyCounts(orderId);
    return {
      outcome: "metenzi_no_keys_yet", keysProcessed: 0, ...counts,
      metenziStatus: refetched?.status, confirmPaymentResult: "ok",
      hint: "Metenzi accepted the payment confirmation but still hasn't returned keys. Try again in a few minutes or use 'Add key manually'.",
    };
  }

  // Confirm not supported or errored: still try one more refetch in case Metenzi
  // independently fulfilled in the interval since the first call.
  const final = await getOrderById(config, order.externalOrderId);
  if (final?.keys && final.keys.length > 0) {
    const processed = await deliver(final.id, final.keys.length, final);
    const counts = await getKeyCounts(orderId);
    return { outcome: "delivered", keysProcessed: processed, ...counts, metenziStatus: final.status, confirmPaymentResult: confirm.result === "error" ? "error" : "not_supported" };
  }

  const counts = await getKeyCounts(orderId);
  if (confirm.result === "not_supported") {
    return {
      outcome: "metenzi_no_keys_yet", keysProcessed: 0, ...counts,
      metenziStatus: final?.status, confirmPaymentResult: "not_supported",
      hint: "Metenzi has no payment-confirmation endpoint exposed. Contact their support to retry assignment, or use 'Add key manually'.",
    };
  }
  return {
    outcome: "metenzi_not_responding", keysProcessed: 0, ...counts,
    metenziStatus: final?.status, confirmPaymentResult: "error",
    hint: "Metenzi rejected the confirmation request. Check API credentials, or use 'Add key manually'.",
  };
}

async function deliver(metenziOrderId: string, keyCount: number, fullOrder: { id: string; keys?: { code: string; productId: string }[] }): Promise<number> {
  await handleWebhookEvent("order.fulfilled", { id: metenziOrderId, keys: fullOrder.keys ?? [] });
  return keyCount;
}

async function getKeyCounts(orderId: number): Promise<{ totalDelivered: number; totalExpected: number }> {
  const items = await db.select({ id: orderItems.id, quantity: orderItems.quantity })
    .from(orderItems).where(eq(orderItems.orderId, orderId));
  const totalExpected = items.reduce((s, i) => s + i.quantity, 0);
  const ids = items.map((i) => i.id);
  const totalDelivered = ids.length > 0
    ? (await db.select({ id: licenseKeys.id }).from(licenseKeys).where(inArray(licenseKeys.orderItemId, ids))).length
    : 0;
  return { totalDelivered, totalExpected };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
