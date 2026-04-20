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
import { appendWebhookLog } from "../lib/webhook-log";
import { createStripeClient } from "../lib/stripe-client";
import { getActivePaymentConfig } from "../lib/payment-config";
import { verifyCheckoutSignature } from "../lib/checkout-com-client";
import { runFulfillment } from "../services/order-pipeline";
import { scoreOrder } from "../services/risk-scoring";
import { sendOrderConfirmationOnly } from "../services/order-emails";
import { creditWallet } from "../services/wallet-service";
import { restorePoints } from "../services/loyalty-service";
import { parseFulfillmentPayload } from "./checkout-session";

const router = Router();

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

// In-memory Metenzi webhook ID deduplication — 10-minute window (mirrors Checkout.com pattern)
const seenMetenziWebhookIds = new Map<string, number>();
const METENZI_REPLAY_WINDOW_MS = 10 * 60 * 1000;

function isMetenziDuplicate(webhookId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of seenMetenziWebhookIds) {
    if (now - ts > METENZI_REPLAY_WINDOW_MS) seenMetenziWebhookIds.delete(id);
  }
  if (seenMetenziWebhookIds.has(webhookId)) return true;
  seenMetenziWebhookIds.set(webhookId, now);
  return false;
}

// Metenzi incoming webhook signature format: HMAC-SHA256(webhookSecret, timestamp + "." + eventType + "." + body)
// Headers: X-Metenzi-Signature, X-Metenzi-Timestamp, X-Metenzi-Event
function verifySignature(
  body: string,
  timestamp: string,
  eventType: string,
  signature: string,
  secret: string,
): boolean {
  const rawSecret = secret.replace(/^whsec_/, "");
  const payload = `${timestamp}.${eventType}.${body}`;
  const expected = crypto.createHmac("sha256", rawSecret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function isReplayAttack(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return true;
  // Metenzi sends timestamp in milliseconds; if the value looks like seconds (< 1e12), convert
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  const age = Math.abs(Date.now() - tsMs);
  return age > REPLAY_WINDOW_MS;
}

router.get("/webhooks/metenzi", (req, res) => {
  // Metenzi uses "metenzi_challenge" query param for verification
  const challenge = (req.query.metenzi_challenge ?? req.query.challenge) as string | undefined;
  if (typeof challenge === "string" && challenge.length > 0) {
    logger.info({ challenge }, "Metenzi webhook verification challenge received");
    appendWebhookLog({ direction: "in", source: "metenzi", event: "challenge", status: 200, outcome: "challenge", body: { challenge } });
    res.type("text/plain").send(challenge);
    return;
  }
  res.json({ status: "ok", message: "Metenzi webhook endpoint active" });
});

router.post("/webhooks/metenzi", async (req, res) => {
  // Metenzi actual webhook headers: X-Webhook-Signature, X-Webhook-Event, X-Webhook-ID
  // (Also accept X-Metenzi-* variants for backwards compatibility)
  const signature = (req.headers["x-webhook-signature"] ?? req.headers["x-metenzi-signature"]) as string | undefined;
  const eventHeader = (req.headers["x-webhook-event"] ?? req.headers["x-metenzi-event"]) as string | undefined;
  // Timestamp is optional — Metenzi backorder webhooks do not include it
  const timestamp = (req.headers["x-webhook-timestamp"] ?? req.headers["x-metenzi-timestamp"]) as string | undefined;
  const webhookId = (req.headers["x-webhook-id"] ?? req.headers["x-metenzi-id"]) as string | undefined;

  // Capture all headers for debug logging
  const incomingHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") incomingHeaders[k] = v;
  }

  logger.info({ headers: incomingHeaders, body: req.body }, "Metenzi webhook POST received");

  if (!signature) {
    logger.warn({ headerKeys: Object.keys(req.headers) }, "Webhook missing signature header (checked x-webhook-signature and x-metenzi-signature)");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventHeader ?? "unknown", status: 401, outcome: "invalid_sig", headers: incomingHeaders, body: req.body, error: "Missing signature header" });
    res.status(401).json({ error: "Missing signature header" });
    return;
  }

  // Only validate timestamp / replay window when a timestamp is actually present
  if (timestamp && isReplayAttack(timestamp)) {
    logger.warn({ timestamp, now: Date.now() }, "Webhook replay attack detected");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventHeader ?? "unknown", status: 401, outcome: "replay", headers: incomingHeaders, body: req.body, error: `Timestamp ${timestamp} too old` });
    res.status(401).json({ error: "Request too old" });
    return;
  }

  const config = await getMetenziConfig();
  if (!config) {
    logger.error("Webhook received but Metenzi not configured");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventHeader ?? "unknown", status: 503, outcome: "unknown", headers: incomingHeaders, body: req.body, error: "Metenzi not configured" });
    res.status(503).json({ error: "Webhook handler not configured" });
    return;
  }

  const rawBody = req.rawBody ?? JSON.stringify(req.body);
  const eventType = eventHeader ?? (req.body?.event as string) ?? "";

  // Try webhookSecret first, then fall back to hmacSecret
  const secrets = [config.webhookSecret, config.hmacSecret].filter(Boolean) as string[];
  let valid = false;
  const sigDebug: string[] = [];
  for (const secret of secrets) {
    const rawSec = secret.replace(/^whsec_/, "");
    // Try multiple signature formats — Metenzi docs are inconsistent:
    // 1. With timestamp: HMAC(secret, timestamp + "." + event + "." + body)
    // 2. Body only:      HMAC(secret, body)
    // 3. Event + body:   HMAC(secret, event + "." + body)
    const candidates: string[] = [rawBody, `${eventType}.${rawBody}`];
    if (timestamp) candidates.unshift(`${timestamp}.${eventType}.${rawBody}`);
    for (const payload of candidates) {
      try {
        const expected = crypto.createHmac("sha256", rawSec).update(payload).digest("hex");
        sigDebug.push(`fmt[${payload.slice(0, 30)}…] → exp[${expected.slice(0, 12)}…] got[${signature.slice(0, 12)}…]`);
        const sigBuf = Buffer.from(signature, "hex");
        const expBuf = Buffer.from(expected, "hex");
        if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
          valid = true;
          break;
        }
      } catch (e) {
        sigDebug.push(`error: ${(e as Error).message}`);
      }
    }
    if (valid) break;
  }

  if (!valid) {
    logger.warn({ sig: signature.slice(0, 20) + "…", timestamp, eventType, rawBodyLen: rawBody.length, sigDebug }, "Webhook signature verification failed");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventType, status: 401, outcome: "invalid_sig", headers: incomingHeaders, body: req.body, error: `sig mismatch: ${sigDebug.join(" | ")}` });
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  // Deduplicate using X-Webhook-ID when present
  if (webhookId && isMetenziDuplicate(webhookId)) {
    logger.warn({ webhookId }, "Metenzi webhook duplicate detected — rejected");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventHeader ?? "unknown", status: 200, outcome: "duplicate", headers: incomingHeaders, body: req.body });
    res.json({ received: true }); // 200 so Metenzi doesn't retry
    return;
  }

  // Event and data extraction — Metenzi may send data nested under "data" or at top level
  const event = eventHeader ?? req.body?.event ?? "";
  const data = req.body?.data ?? req.body;

  if (!event) {
    appendWebhookLog({ direction: "in", source: "metenzi", event: "", status: 400, outcome: "bad_body", headers: incomingHeaders, body: req.body, error: "Missing event" });
    res.status(400).json({ error: "Missing event" });
    return;
  }

  try {
    await handleWebhookEvent(event, data);
    appendWebhookLog({ direction: "in", source: "metenzi", event, status: 200, outcome: "ok", body: req.body });
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, event }, "Webhook event handler failed");
    appendWebhookLog({ direction: "in", source: "metenzi", event, status: 500, outcome: "handler_error", headers: incomingHeaders, body: req.body, error: (err as Error).message });
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

  // Risk scoring — runs after payment is confirmed
  const risk = await scoreOrder({
    userId: order.userId ?? undefined,
    guestEmail: payload.billing.email,
    billingCountry: payload.billing.country,
    totalUsd: payload.total,
    items: payload.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    clientIp: payload.clientIp ?? "",
  });

  if (risk.hold) {
    await db.update(orders).set({
      status: "HELD",
      riskHold: true,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      paymentIntentId: paymentIntentId,
      updatedAt: new Date(),
    }).where(eq(orders.id, orderId));
    sendOrderConfirmationOnly(payload.billing, orderNumber || order.orderNumber, orderId, payload.items, payload.total, payload.locale).catch(() => {});
    logger.warn({ orderId, score: risk.score, reasons: risk.reasons }, "Stripe: order held for risk review");
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

  // Risk scoring — runs after payment is confirmed
  const risk = await scoreOrder({
    userId: order.userId ?? undefined,
    guestEmail: payload.billing.email,
    billingCountry: payload.billing.country,
    totalUsd: payload.total,
    items: payload.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    clientIp: payload.clientIp ?? "",
  });

  if (risk.hold) {
    await db.update(orders).set({
      status: "HELD",
      riskHold: true,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      paymentIntentId: paymentId,
      updatedAt: new Date(),
    }).where(eq(orders.id, orderId));
    sendOrderConfirmationOnly(payload.billing, orderNumber || order.orderNumber, orderId, payload.items, payload.total, payload.locale).catch(() => {});
    logger.warn({ orderId, score: risk.score, reasons: risk.reasons }, "Checkout.com: order held for risk review");
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

// Real Metenzi event names (from Metenzi API docs)
const WEBHOOK_EVENTS = [
  "keys.delivered",
  "backorder.fulfilled",
  "claim.created",
  "order.status_changed",
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
      logger.info({ webhookId: webhook.id, webhookUrl, hasSecret: !!webhook.signingSecret }, "Metenzi webhook registered");

      // Auto-save signing secret if Metenzi returned it in the response
      if (webhook.signingSecret) {
        const { encrypt } = await import("../lib/encryption");
        const { db } = await import("@workspace/db");
        const { apiProviders } = await import("@workspace/db/schema");
        const { eq } = await import("drizzle-orm");
        const { clearMetenziConfigCache } = await import("../lib/metenzi-config");
        const encrypted = encrypt(webhook.signingSecret);
        await db.update(apiProviders)
          .set({ webhookSecretEncrypted: encrypted, updatedAt: new Date() })
          .where(eq(apiProviders.slug, "metenzi"));
        clearMetenziConfigCache();
        logger.info({ webhookId: webhook.id }, "Auto-saved Metenzi webhook signing secret");
      }

      res.json({ webhook, secretSaved: !!webhook.signingSecret });
    } catch (err) {
      logger.error({ err }, "Failed to register Metenzi webhook");
      const msg = err instanceof Error ? err.message : "Registration failed";
      const status = msg.includes("403") ? 403 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

export default router;
