import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { getActivePaymentConfig } from "../lib/payment-config";
import { verifyCheckoutSignature } from "../lib/checkout-com-client";
import { runFulfillment } from "../services/order-pipeline";
import { scoreOrder } from "../services/risk-scoring";
import { sendOrderConfirmationOnly } from "../services/order-emails";
import { creditWallet } from "../services/wallet-service";
import { restorePoints } from "../services/loyalty-service";
import { parseFulfillmentPayload } from "./checkout-session";

const router = Router();

const seenCheckoutEventIds = new Map<string, number>();
const CHECKOUT_REPLAY_WINDOW_MS = 10 * 60 * 1000;

function isCheckoutReplay(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of seenCheckoutEventIds) {
    if (now - ts > CHECKOUT_REPLAY_WINDOW_MS) seenCheckoutEventIds.delete(id);
  }
  if (seenCheckoutEventIds.has(eventId)) return true;
  seenCheckoutEventIds.set(eventId, now);
  return false;
}

router.post("/webhooks/checkout", async (req, res) => {
  const signature = req.headers["cko-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ error: "Missing Cko-Signature header" });
    return;
  }

  const config = await getActivePaymentConfig();
  const webhookSecret = config?.provider === "checkout" && config.webhookSecret ? config.webhookSecret : undefined;
  if (!webhookSecret) {
    logger.warn("Checkout.com webhook: no webhook secret configured");
    res.status(400).json({ error: "Checkout.com webhook not configured" });
    return;
  }

  const rawBody = req.rawBody ?? JSON.stringify(req.body);
  if (!verifyCheckoutSignature(rawBody, signature, webhookSecret)) {
    logger.warn("Checkout.com webhook signature verification failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const eventId: string = req.body?.id ?? "";
  if (!eventId || isCheckoutReplay(eventId)) {
    logger.warn({ eventId }, "Checkout.com webhook replay or missing event ID — rejected");
    res.status(200).json({ received: true });
    return;
  }

  res.json({ received: true });

  const type: string = req.body?.type ?? "";
  const data = req.body?.data ?? req.body;

  try {
    if (type === "payment_approved") {
      await handleCheckoutPaymentApproved(data);
    } else if (type === "payment_declined" || type === "payment_expired") {
      await handleCheckoutPaymentFailed(data, type);
    }
  } catch (err) {
    logger.error({ err, type }, "Checkout.com webhook handler threw");
  }
});

async function handleCheckoutPaymentApproved(data: Record<string, unknown>) {
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const orderId = parseInt(metadata.orderId ?? "0", 10);
  const orderNumber = metadata.orderNumber ?? "";
  if (!orderId) { logger.error({ data }, "Checkout.com payment_approved: no orderId in metadata"); return; }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) { logger.error({ orderId }, "Checkout.com payment_approved: order not found"); return; }
  if (order.status !== "PENDING" && order.status !== "PROCESSING") {
    logger.warn({ orderId, status: order.status }, "Checkout.com payment_approved: order already processed, skipping");
    return;
  }

  const paymentId = (data.id ?? data.payment_id ?? "") as string;
  const payload = parseFulfillmentPayload(order.notes);
  if (!payload) { logger.error({ orderId }, "Checkout.com payment_approved: no fulfillment payload in order notes"); return; }

  const risk = await scoreOrder({
    userId: order.userId ?? undefined, guestEmail: payload.billing.email,
    billingCountry: payload.billing.country, totalUsd: payload.total,
    items: payload.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    clientIp: payload.clientIp ?? "",
  });

  if (risk.hold) {
    await db.update(orders).set({
      status: "HELD", riskHold: true, riskScore: risk.score, riskReasons: risk.reasons,
      paymentIntentId: paymentId, updatedAt: new Date(),
    }).where(eq(orders.id, orderId));
    sendOrderConfirmationOnly(payload.billing, orderNumber || order.orderNumber, orderId, payload.items, payload.total, payload.locale).catch((err) => {
      logger.error({ err, orderId }, "Checkout.com: failed to send hold confirmation email (non-fatal)");
    });
    logger.warn({ orderId, score: risk.score, reasons: risk.reasons }, "Checkout.com: order held for risk review");
    return;
  }

  try {
    await runFulfillment(orderId, orderNumber || order.orderNumber, paymentId, {
      billing: payload.billing, items: payload.items, giftCards: payload.giftCards,
      flashVariantMap: payload.flashVariantMap.length ? new Map<number, number>(payload.flashVariantMap) : undefined,
      affiliateRefCode: payload.affiliateRefCode, loyaltyPointsUsed: payload.loyaltyPointsUsed,
      services: payload.services, guestPasswordHash: payload.guestPasswordHash,
      locale: payload.locale, userId: order.userId ?? undefined,
    }, payload.total);
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    logger.info({ orderId, orderNumber: order.orderNumber }, "Checkout.com: order fulfilled");
  } catch (err) {
    logger.error({ err, orderId }, "Checkout.com payment_approved: fulfillment failed");
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId)).catch((e) => {
      logger.error({ err: e, orderId }, "Checkout.com: failed to clear fulfillment notes after error");
    });
  }
}

async function handleCheckoutPaymentFailed(data: Record<string, unknown>, eventType: string) {
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const orderId = parseInt(metadata.orderId ?? "0", 10);
  if (!orderId) return;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "PENDING") return;

  const walletUsed = parseFloat(order.walletAmountUsed ?? "0");
  if (walletUsed > 0.01 && order.userId) {
    await creditWallet(order.userId, walletUsed, "REFUND",
      `Cancelled: Checkout.com payment failed for ${order.orderNumber}`, `reversal:${orderId}`,
    ).catch((err) => logger.error({ err, orderId }, "Checkout.com failed: wallet restore failed"));
  }

  const payload = parseFulfillmentPayload(order.notes);
  if (payload?.loyaltyPointsUsed && payload.loyaltyAccountId) {
    await restorePoints(payload.loyaltyAccountId, payload.loyaltyPointsUsed,
      `Points restored: Checkout.com payment failed for ${order.orderNumber}`, orderId,
    ).catch((err) => logger.error({ err, orderId }, "Checkout.com failed: loyalty restore failed"));
  }

  const responseCode = (data.response_code ?? data.responseCode) as string | undefined;
  const responseSummary = (data.response_summary ?? data.responseSummary) as string | undefined;
  const baseLabel = eventType === "payment_expired"
    ? "Checkout.com payment link expired before customer paid"
    : "Checkout.com payment was declined";
  const detail = [responseCode && `code ${responseCode}`, responseSummary].filter(Boolean).join(" — ");
  const failureReason = detail ? `${baseLabel} (${detail}).` : `${baseLabel}.`;

  await db.update(orders).set({
    status: "FAILED",
    notes: null,
    failureReason,
    updatedAt: new Date(),
  }).where(eq(orders.id, orderId));
  logger.info({ orderId, orderNumber: order.orderNumber, responseCode, responseSummary }, "Checkout.com: payment failed, order cancelled");
}

export default router;
