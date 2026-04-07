import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { listWebhooks, createWebhook, deleteWebhook } from "../lib/metenzi-endpoints";

const router = Router();

const WEBHOOK_EVENTS = [
  "order.created", "order.completed", "order.failed", "order.refunded",
  "license.generated", "license.revoked", "product.updated", "stock.low",
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
  const invalid = events.filter((e: string) => !WEBHOOK_EVENTS.includes(e));
  if (invalid.length > 0) { res.status(400).json({ error: `Invalid events: ${invalid.join(", ")}` }); return; }
  try {
    const webhook = await createWebhook(config, url, events);
    res.json(webhook);
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.delete("/admin/settings/webhooks/:id", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.status(400).json({ error: "Metenzi API not configured" }); return; }
  try {
    const ok = await deleteWebhook(config, req.params.id);
    if (ok) { res.json({ success: true }); } else { res.status(500).json({ error: "Failed to delete webhook" }); }
  } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

router.get("/admin/settings/webhooks/endpoint-url", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const baseUrl = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
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
