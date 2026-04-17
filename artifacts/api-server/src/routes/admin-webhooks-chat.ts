import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { listWebhooks, createWebhook, deleteWebhook } from "../lib/metenzi-endpoints";
import { paramString } from "../lib/route-params";
import { getWebhookLog } from "../lib/webhook-log";

const router = Router();

// Real Metenzi event names (from Metenzi API docs)
const WEBHOOK_EVENTS = [
  "keys.delivered",
  "backorder.fulfilled",
  "claim.created",
  "order.status_changed",
];

router.get("/admin/settings/webhooks", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.json({ configured: false, webhooks: [], events: WEBHOOK_EVENTS }); return; }
  try {
    const webhooks = await listWebhooks(config);
    res.json({ configured: true, webhooks, events: WEBHOOK_EVENTS });
  } catch (e) { res.json({ configured: true, webhooks: [], events: WEBHOOK_EVENTS, error: (e as Error).message }); }
});

router.post("/admin/settings/webhooks", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.status(400).json({ error: "Metenzi API not configured" }); return; }
  const { url, events } = req.body;
  if (!url || typeof url !== "string") { res.status(400).json({ error: "URL required" }); return; }
  if (!Array.isArray(events) || events.length === 0) { res.status(400).json({ error: "At least one event required" }); return; }
  // No strict validation — pass events as-is to Metenzi
  try {
    const webhook = await createWebhook(config, url, events);
    res.json(webhook);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.delete("/admin/settings/webhooks/:id", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.status(400).json({ error: "Metenzi API not configured" }); return; }
  try {
    const ok = await deleteWebhook(config, paramString(req.params, "id"));
    if (ok) { res.json({ success: true }); } else { res.status(500).json({ error: "Failed to delete webhook" }); }
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get("/admin/settings/webhook-logs", requireAuth, requireAdmin, requirePermission("manageSettings"), (_req, res) => {
  res.json({ logs: getWebhookLog() });
});

router.get("/admin/settings/webhooks/endpoint-url", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost") as string;
  const proto = (req.headers["x-forwarded-proto"] ?? (host === "localhost" ? "http" : "https")) as string;
  const baseUrl = process.env.APP_PUBLIC_URL ?? `${proto}://${host}`;
  res.json({ url: `${baseUrl}/api/webhooks/metenzi` });
});

router.get("/admin/settings/live-chat", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [s] = await db.select({ liveChatEnabled: siteSettings.liveChatEnabled, liveChatCode: siteSettings.liveChatCode }).from(siteSettings);
  res.json({ liveChatEnabled: s?.liveChatEnabled ?? false, liveChatCode: s?.liveChatCode ?? "" });
});

router.put("/admin/settings/live-chat", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings);
  const data = {
    liveChatEnabled: Boolean(req.body.liveChatEnabled),
    liveChatCode: req.body.liveChatCode ?? null,
    updatedAt: new Date(),
  };
  if (existing) { await db.update(siteSettings).set(data).where(eq(siteSettings.id, existing.id)); }
  else { await db.insert(siteSettings).values(data); }
  res.json({ success: true });
});

router.get("/settings/live-chat", async (_req, res) => {
  const [s] = await db.select({ liveChatEnabled: siteSettings.liveChatEnabled, liveChatCode: siteSettings.liveChatCode }).from(siteSettings);
  if (!s?.liveChatEnabled || !s.liveChatCode) { res.json({ enabled: false }); return; }
  res.json({ enabled: true, code: s.liveChatCode });
});

export default router;
