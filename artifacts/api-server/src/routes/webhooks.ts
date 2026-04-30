import { Router } from "express";
import crypto from "node:crypto";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createWebhook } from "../lib/metenzi-endpoints";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { handleWebhookEvent } from "../services/webhook-handlers";
import { logger } from "../lib/logger";
import { appendWebhookLog } from "../lib/webhook-log";

const router = Router();

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

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

function isReplayAttack(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return true;
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  const age = Math.abs(Date.now() - tsMs);
  return age > REPLAY_WINDOW_MS;
}

router.get("/webhooks/metenzi", (req, res) => {
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
  const signature = (req.headers["x-webhook-signature"] ?? req.headers["x-metenzi-signature"]) as string | undefined;
  const eventHeader = (req.headers["x-webhook-event"] ?? req.headers["x-metenzi-event"]) as string | undefined;
  const timestamp = (req.headers["x-webhook-timestamp"] ?? req.headers["x-metenzi-timestamp"]) as string | undefined;
  const webhookId = (req.headers["x-webhook-id"] ?? req.headers["x-metenzi-id"]) as string | undefined;

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

  // Metenzi signs with the secret VERBATIM (incl. `whsec_` prefix) and the raw body
  // only — no event/timestamp concatenation. We try the verbatim form first, then
  // the prefix-stripped variant, then the legacy event/timestamp prefixed forms,
  // for back-compat with older deliveries.
  const secrets = [config.webhookSecret, config.hmacSecret].filter(Boolean) as string[];
  let valid = false;
  const sigDebug: string[] = [];
  for (const secret of secrets) {
    const secretVariants = secret.startsWith("whsec_") ? [secret, secret.slice(6)] : [secret];
    for (const sec of secretVariants) {
      const candidates: string[] = [rawBody, `${eventType}.${rawBody}`];
      if (timestamp) candidates.unshift(`${timestamp}.${eventType}.${rawBody}`);
      for (const payload of candidates) {
        try {
          const expected = crypto.createHmac("sha256", sec).update(payload).digest("hex");
          sigDebug.push(`secLen=${sec.length} fmt[${payload.slice(0, 30)}…] → exp[${expected.slice(0, 12)}…] got[${signature.slice(0, 12)}…]`);
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
    if (valid) break;
  }

  if (!valid) {
    logger.warn({ sig: signature.slice(0, 20) + "…", timestamp, eventType, rawBodyLen: rawBody.length, sigDebug }, "Webhook signature verification failed");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventType, status: 401, outcome: "invalid_sig", headers: incomingHeaders, body: req.body, error: `sig mismatch: ${sigDebug.join(" | ")}` });
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  if (webhookId && isMetenziDuplicate(webhookId)) {
    logger.warn({ webhookId }, "Metenzi webhook duplicate detected — rejected");
    appendWebhookLog({ direction: "in", source: "metenzi", event: eventHeader ?? "unknown", status: 200, outcome: "duplicate", headers: incomingHeaders, body: req.body });
    res.json({ received: true });
    return;
  }

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
