import { Router } from "express";
import crypto from "node:crypto";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createWebhook } from "../lib/metenzi-endpoints";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { handleWebhookEvent } from "../services/webhook-handlers";
import { logger } from "../lib/logger";

const router = Router();

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function verifySignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  const payload = `${timestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
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
  const signature = req.headers["x-signature"];
  const timestamp = req.headers["x-timestamp"];

  if (typeof signature !== "string" || typeof timestamp !== "string") {
    logger.warn("Webhook missing signature headers");
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

  const rawBody = JSON.stringify(req.body);
  let valid: boolean;
  try {
    valid = verifySignature(rawBody, timestamp, signature, config.hmacSecret);
  } catch {
    valid = false;
  }

  if (!valid) {
    logger.warn("Webhook signature verification failed");
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

    const baseUrl = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
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
