import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createStripeClient } from "../lib/stripe-client";
import { runFulfillment } from "../services/order-pipeline";
import { scoreOrder } from "../services/risk-scoring";
import { sendOrderConfirmationOnly } from "../services/order-emails";
import { creditWallet } from "../services/wallet-service";
import { restorePoints } from "../services/loyalty-service";
import { parseFulfillmentPayload } from "./checkout-session";

const router = Router();

router.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const paymentConfig = await getActivePaymentConfig();
  const webhookSecret = paymentConfig?.provider === "stripe" && paymentConfig.webhookSecret
    ? paymentConfig.webhookSecret
    : process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.warn("Stripe webhook: no webhook secret configured in DB or environment");
    res.status(400).json({ error: "Stripe webhook not configured" });
    return;
  }

  let event: import("stripe").Stripe.Event;
  try {
    const secretKey = paymentConfig?.provider === "stripe" && paymentConfig.secretKey
      ? paymentConfig.secretKey
      : process.env.STRIPE_SECRET_KEY ?? "";
    const stripe = createStripeClient(secretKey);
    const rawBody: string | Buffer = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  res.json({ received: true });

  try {
    if (event.type === "checkout.session.completed") {
      await handleStripeSessionCompleted(event.data.object as import("stripe").Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      await handleStripeSessionExpired(event.data.object as import("stripe").Stripe.Checkout.Session);
    }
  } catch (err) {
    logger.error({ err, eventType: event.type, eventId: event.id }, "Stripe webhook handler threw");
  }
});

async function handleStripeSessionCompleted(session: import("stripe").Stripe.Checkout.Session) {
  const orderId = parseInt(session.metadata?.orderId ?? "0", 10);
  const orderNumber = session.metadata?.orderNumber ?? "";
  if (!orderId) {
    logger.error({ sessionId: session.id }, "Stripe session.completed: no orderId in metadata");
    return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) { logger.error({ orderId, sessionId: session.id }, "Stripe session.completed: order not found"); return; }
  if (order.status !== "PENDING" && order.status !== "PROCESSING") {
    logger.warn({ orderId, status: order.status }, "Stripe session.completed: order already processed, skipping");
    return;
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? session.id);

  const payload = parseFulfillmentPayload(order.notes);
  if (!payload) { logger.error({ orderId }, "Stripe session.completed: no fulfillment payload in order notes"); return; }

  const risk = await scoreOrder({
    userId: order.userId ?? undefined, guestEmail: payload.billing.email,
    billingCountry: payload.billing.country, totalUsd: payload.total,
    items: payload.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    clientIp: payload.clientIp ?? "",
  });

  if (risk.hold) {
    await db.update(orders).set({
      status: "HELD", riskHold: true, riskScore: risk.score, riskReasons: risk.reasons,
      paymentIntentId, updatedAt: new Date(),
    }).where(eq(orders.id, orderId));
    sendOrderConfirmationOnly(payload.billing, orderNumber || order.orderNumber, orderId, payload.items, payload.total, payload.locale).catch((err) => {
      logger.error({ err, orderId }, "Stripe: failed to send hold confirmation email (non-fatal)");
    });
    logger.warn({ orderId, score: risk.score, reasons: risk.reasons }, "Stripe: order held for risk review");
    return;
  }

  try {
    await runFulfillment(orderId, orderNumber || order.orderNumber, paymentIntentId, {
      billing: payload.billing, items: payload.items, giftCards: payload.giftCards,
      flashVariantMap: payload.flashVariantMap.length ? new Map<number, number>(payload.flashVariantMap) : undefined,
      affiliateRefCode: payload.affiliateRefCode, loyaltyPointsUsed: payload.loyaltyPointsUsed,
      services: payload.services, guestPasswordHash: payload.guestPasswordHash,
      locale: payload.locale, userId: order.userId ?? undefined,
    }, payload.total);
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    logger.info({ orderId, orderNumber: order.orderNumber }, "Stripe: order fulfilled");
  } catch (err) {
    logger.error({ err, orderId }, "Stripe session.completed: fulfillment failed");
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId)).catch((e) => {
      logger.error({ err: e, orderId }, "Stripe: failed to clear fulfillment notes after error");
    });
  }
}

async function handleStripeSessionExpired(session: import("stripe").Stripe.Checkout.Session) {
  const orderId = parseInt(session.metadata?.orderId ?? "0", 10);
  if (!orderId) return;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "PENDING") return;

  const walletUsed = parseFloat(order.walletAmountUsed ?? "0");
  if (walletUsed > 0.01 && order.userId) {
    await creditWallet(order.userId, walletUsed, "REFUND",
      `Cancelled: Stripe session expired for ${order.orderNumber}`, `reversal:${orderId}`,
    ).catch((err) => logger.error({ err, orderId }, "Stripe expired: wallet restore failed"));
  }

  const payload = parseFulfillmentPayload(order.notes);
  if (payload?.loyaltyPointsUsed && payload.loyaltyAccountId) {
    await restorePoints(payload.loyaltyAccountId, payload.loyaltyPointsUsed,
      `Points restored: Stripe session expired for ${order.orderNumber}`, orderId,
    ).catch((err) => logger.error({ err, orderId }, "Stripe expired: loyalty restore failed"));
  }

  await db.update(orders).set({ status: "FAILED", notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId));
  logger.info({ orderId, orderNumber: order.orderNumber }, "Stripe: session expired, order cancelled");
}

export default router;
