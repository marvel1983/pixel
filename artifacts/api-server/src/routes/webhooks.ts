import { Router } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders } from "@workspace/db/schema";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createWebhook } from "../lib/metenzi-endpoints";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { handleWebhookEvent } from "../services/webhook-handlers";
import { logger } from "../lib/logger";
import { createStripeClient } from "../lib/stripe-client";
import { getActivePaymentConfig } from "../lib/payment-config";
import { verifyCheckoutSignature } from "../lib/checkout-com-client";
import { runFulfillment } from "../services/order-pipeline";
import { creditWallet } from "../services/wallet-service";
import { restorePoints } from "../services/loyalty-service";
import { parseFulfillmentPayload } from "./checkout-session";

const router = Router();

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

// Metenzi signature format: HMAC-SHA256(secret, timestamp + "." + METHOD + "." + path + "." + body)
// Headers: X-Signature-Timestamp, X-Signature
function verifySignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  method: string,
  path: string,
): boolean {
  const rawSecret = secret.replace(/^whsec_/, "");
  const rawSig = signature.replace(/^sha256=/, "");
  const payload = `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
  const expected = crypto.createHmac("sha256", rawSecret).update(payload).digest("hex");
  try {
    if (rawSig.length === expected.length) {
      return crypto.timingSafeEqual(Buffer.from(rawSig, "hex"), Buffer.from(expected, "hex"));
    }
    // fallback: base64
    const expectedB64 = Buffer.from(expected, "hex").toString("base64");
    return rawSig === expectedB64 || rawSig === Buffer.from(expected, "hex").toString("base64url");
  } catch {
    return false;
  }
}

function isReplayAttack(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return true;
  const age = Math.abs(Date.now() - ts * 1000);
  return age > REPLAY_WINDOW_MS;
}

router.get("/webhooks/metenzi", (req, res) => {
  const challenge = req.query.challenge;
  if (typeof challenge === "string" && challenge.length > 0) {
    logger.info("Metenzi webhook verification challenge received");
    res.json({ challenge });
    return;
  }
  res.json({ status: "ok", message: "Metenzi webhook endpoint active" });
});

router.post("/webhooks/metenzi", async (req, res) => {
  // Handle verification challenge (Metenzi sends this without HMAC headers)
  const bodyChallenge = req.body?.challenge;
  if (bodyChallenge && typeof bodyChallenge === "string") {
    logger.info("Metenzi webhook challenge received (POST)");
    res.json({ challenge: bodyChallenge });
    return;
  }

  // Metenzi uses X-Signature-Timestamp (not X-Timestamp)
  const signature = req.headers["x-signature"] as string | undefined;
  const timestamp = (req.headers["x-signature-timestamp"] ?? req.headers["x-timestamp"]) as string | undefined;

  if (!signature || !timestamp) {
    logger.warn({ headers: Object.keys(req.headers) }, "Webhook missing signature headers");
    res.status(401).json({ error: "Missing signature headers" });
    return;
  }

  if (isReplayAttack(timestamp)) {
    logger.warn({ timestamp }, "Webhook replay attack detected");
    res.status(401).json({ error: "Request too old" });
    return;
  }

  const config = await getMetenziConfig();
  if (!config) {
    logger.error("Webhook received but Metenzi not configured");
    res.status(503).json({ error: "Webhook handler not configured" });
    return;
  }

  const rawBody = req.rawBody ?? JSON.stringify(req.body);
  // Use dedicated webhookSecret for inbound verification; fall back to hmacSecret
  const verifySecret = config.webhookSecret ?? config.hmacSecret;
  // Path for signature: just the pathname without query string
  const reqPath = req.path || "/api/webhooks/metenzi";
  let valid: boolean;
  try {
    valid = verifySignature(rawBody, timestamp, signature, verifySecret, req.method, reqPath);
  } catch {
    valid = false;
  }

  if (!valid) {
    logger.warn({ sig: signature.slice(0, 20) + "…", timestamp, path: reqPath }, "Webhook signature verification failed");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const event = req.body?.event;
  const data = req.body?.data;

  if (!event || !data) {
    res.status(400).json({ error: "Missing event or data" });
    return;
  }

  try {
    await handleWebhookEvent(event, data);
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, event }, "Webhook event handler failed");
    res.status(500).json({ error: "Event processing failed" });
  }
});

// ── Stripe webhook ────────────────────────────────────────────────────────────

router.post("/webhooks/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  // Resolve webhook secret from DB config, fall back to env for legacy deployments
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
    const rawBody = req.rawBody ?? JSON.stringify(req.body);
    event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  // Acknowledge immediately; process asynchronously to avoid Stripe timeout
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
  if (!order) {
    logger.error({ orderId, sessionId: session.id }, "Stripe session.completed: order not found");
    return;
  }
  if (order.status !== "PENDING" && order.status !== "PROCESSING") {
    logger.warn({ orderId, status: order.status }, "Stripe session.completed: order already processed, skipping");
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? session.id);

  const payload = parseFulfillmentPayload(order.notes);
  if (!payload) {
    logger.error({ orderId }, "Stripe session.completed: no fulfillment payload in order notes");
    return;
  }

  try {
    await runFulfillment(
      orderId,
      orderNumber || order.orderNumber,
      paymentIntentId,
      {
        billing: payload.billing,
        items: payload.items,
        giftCards: payload.giftCards,
        flashVariantMap: payload.flashVariantMap.length
          ? new Map<number, number>(payload.flashVariantMap)
          : undefined,
        affiliateRefCode: payload.affiliateRefCode,
        loyaltyPointsUsed: payload.loyaltyPointsUsed,
        services: payload.services,
        guestPasswordHash: payload.guestPasswordHash,
        locale: payload.locale,
        userId: order.userId ?? undefined,
      },
      payload.total,
    );

    // Clear the temporary fulfillment payload from notes
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    logger.info({ orderId, orderNumber: order.orderNumber }, "Stripe: order fulfilled");
  } catch (err) {
    logger.error({ err, orderId }, "Stripe session.completed: fulfillment failed");
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId)).catch(() => {});
  }
}

async function handleStripeSessionExpired(session: import("stripe").Stripe.Checkout.Session) {
  const orderId = parseInt(session.metadata?.orderId ?? "0", 10);
  if (!orderId) return;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "PENDING") return;

  // Restore wallet if it was debited
  const walletUsed = parseFloat(order.walletAmountUsed ?? "0");
  if (walletUsed > 0.01 && order.userId) {
    await creditWallet(
      order.userId, walletUsed, "REFUND",
      `Cancelled: Stripe session expired for ${order.orderNumber}`,
      `reversal:${orderId}`,
    ).catch((err) => logger.error({ err, orderId }, "Stripe expired: wallet restore failed"));
  }

  // Restore loyalty points if they were redeemed
  const payload = parseFulfillmentPayload(order.notes);
  if (payload?.loyaltyPointsUsed && payload.loyaltyAccountId) {
    await restorePoints(
      payload.loyaltyAccountId, payload.loyaltyPointsUsed,
      `Points restored: Stripe session expired for ${order.orderNumber}`,
      orderId,
    ).catch((err) => logger.error({ err, orderId }, "Stripe expired: loyalty restore failed"));
  }

  await db.update(orders)
    .set({ status: "FAILED", notes: null, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  logger.info({ orderId, orderNumber: order.orderNumber }, "Stripe: session expired, order cancelled");
}

// ── Checkout.com webhook ──────────────────────────────────────────────────────

// In-memory event ID deduplication — 10-minute window, same approach as Stripe's 5-min timestamp window
const seenCheckoutEventIds = new Map<string, number>();
const CHECKOUT_REPLAY_WINDOW_MS = 10 * 60 * 1000;

function isCheckoutReplay(eventId: string): boolean {
  const now = Date.now();
  // Evict expired entries
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
  const webhookSecret = config?.provider === "checkout" && config.webhookSecret
    ? config.webhookSecret
    : undefined;

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
    res.status(200).json({ received: true }); // 200 so Checkout.com doesn't retry
    return;
  }

  res.json({ received: true });

  const type: string = req.body?.type ?? "";
  const data = req.body?.data ?? req.body;

  try {
    if (type === "payment_approved") {
      await handleCheckoutPaymentApproved(data);
    } else if (type === "payment_declined" || type === "payment_expired") {
      await handleCheckoutPaymentFailed(data);
    }
  } catch (err) {
    logger.error({ err, type }, "Checkout.com webhook handler threw");
  }
});

async function handleCheckoutPaymentApproved(data: Record<string, unknown>) {
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const orderId = parseInt(metadata.orderId ?? "0", 10);
  const orderNumber = metadata.orderNumber ?? "";
  if (!orderId) {
    logger.error({ data }, "Checkout.com payment_approved: no orderId in metadata");
    return;
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    logger.error({ orderId }, "Checkout.com payment_approved: order not found");
    return;
  }
  if (order.status !== "PENDING" && order.status !== "PROCESSING") {
    logger.warn({ orderId, status: order.status }, "Checkout.com payment_approved: order already processed, skipping");
    return;
  }

  const paymentId = (data.id ?? data.payment_id ?? "") as string;
  const payload = parseFulfillmentPayload(order.notes);
  if (!payload) {
    logger.error({ orderId }, "Checkout.com payment_approved: no fulfillment payload in order notes");
    return;
  }

  try {
    await runFulfillment(
      orderId,
      orderNumber || order.orderNumber,
      paymentId,
      {
        billing: payload.billing,
        items: payload.items,
        giftCards: payload.giftCards,
        flashVariantMap: payload.flashVariantMap.length ? new Map<number, number>(payload.flashVariantMap) : undefined,
        affiliateRefCode: payload.affiliateRefCode,
        loyaltyPointsUsed: payload.loyaltyPointsUsed,
        services: payload.services,
        guestPasswordHash: payload.guestPasswordHash,
        locale: payload.locale,
        userId: order.userId ?? undefined,
      },
      payload.total,
    );
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId));
    logger.info({ orderId, orderNumber: order.orderNumber }, "Checkout.com: order fulfilled");
  } catch (err) {
    logger.error({ err, orderId }, "Checkout.com payment_approved: fulfillment failed");
    await db.update(orders).set({ notes: null, updatedAt: new Date() }).where(eq(orders.id, orderId)).catch(() => {});
  }
}

async function handleCheckoutPaymentFailed(data: Record<string, unknown>) {
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const orderId = parseInt(metadata.orderId ?? "0", 10);
  if (!orderId) return;

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || order.status !== "PENDING") return;

  const walletUsed = parseFloat(order.walletAmountUsed ?? "0");
  if (walletUsed > 0.01 && order.userId) {
    await creditWallet(
      order.userId, walletUsed, "REFUND",
      `Cancelled: Checkout.com payment failed for ${order.orderNumber}`,
      `reversal:${orderId}`,
    ).catch((err) => logger.error({ err, orderId }, "Checkout.com failed: wallet restore failed"));
  }

  const payload = parseFulfillmentPayload(order.notes);
  if (payload?.loyaltyPointsUsed && payload.loyaltyAccountId) {
    await restorePoints(
      payload.loyaltyAccountId, payload.loyaltyPointsUsed,
      `Points restored: Checkout.com payment failed for ${order.orderNumber}`,
      orderId,
    ).catch((err) => logger.error({ err, orderId }, "Checkout.com failed: loyalty restore failed"));
  }

  await db.update(orders)
    .set({ status: "FAILED", notes: null, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  logger.info({ orderId, orderNumber: order.orderNumber }, "Checkout.com: payment failed, order cancelled");
}

// ── Metenzi webhook ───────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  "order.fulfilled",
  "order.backorder",
  "order.cancelled",
  "claim.opened",
  "claim.resolved",
];

router.post(
  "/webhooks/metenzi/register",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const config = await getMetenziConfig();
    if (!config) {
      res.status(400).json({ error: "Metenzi integration not configured" });
      return;
    }

    const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost") as string;
    const proto = (req.headers["x-forwarded-proto"] ?? (host === "localhost" ? "http" : "https")) as string;
    const baseUrl = process.env.APP_PUBLIC_URL ?? `${proto}://${host}`;
    const webhookUrl = `${baseUrl}/api/webhooks/metenzi`;

    try {
      const webhook = await createWebhook(config, webhookUrl, WEBHOOK_EVENTS);
      logger.info({ webhookId: webhook.id, webhookUrl }, "Metenzi webhook registered");
      res.json({ webhook });
    } catch (err) {
      logger.error({ err }, "Failed to register Metenzi webhook");
      const msg = err instanceof Error ? err.message : "Registration failed";
      res.status(500).json({ error: msg });
    }
  },
);

export default router;
