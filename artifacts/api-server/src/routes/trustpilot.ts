import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { encrypt, decrypt } from "../lib/encryption";

const router = Router();

router.get("/trustpilot/config", async (_req, res) => {
  const rows = await db.select().from(siteSettings);
  if (!rows.length) { res.json({ enabled: false }); return; }
  const s = rows[0];
  res.json({
    enabled: s.trustpilotEnabled,
    businessUnitId: s.trustpilotBusinessUnitId ?? null,
    trustpilotUrl: s.trustpilotUrl ?? null,
    cachedRating: s.trustpilotCachedRating ? parseFloat(s.trustpilotCachedRating) : 4.7,
    cachedCount: s.trustpilotCachedCount ?? 2847,
  });
});

router.get("/admin/trustpilot", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const rows = await db.select().from(siteSettings);
  if (!rows.length) { res.json({ settings: null }); return; }
  const s = rows[0];
  res.json({
    settings: {
      enabled: s.trustpilotEnabled,
      businessUnitId: s.trustpilotBusinessUnitId ?? "",
      trustpilotUrl: s.trustpilotUrl ?? "",
      hasApiKey: !!s.trustpilotApiKeyEncrypted,
      inviteDelayDays: s.trustpilotInviteDelayDays,
      cachedRating: s.trustpilotCachedRating ? parseFloat(s.trustpilotCachedRating) : 4.7,
      cachedCount: s.trustpilotCachedCount ?? 2847,
    },
  });
});

router.put("/admin/trustpilot", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { enabled, businessUnitId, trustpilotUrl: tpUrl, apiKey, inviteDelayDays, cachedRating, cachedCount } = req.body;
  const update: Partial<typeof siteSettings.$inferInsert> = { updatedAt: new Date() };

  if (typeof enabled === "boolean") update.trustpilotEnabled = enabled;
  if (typeof businessUnitId === "string") update.trustpilotBusinessUnitId = businessUnitId || null;
  if (typeof tpUrl === "string") update.trustpilotUrl = tpUrl || null;
  if (typeof apiKey === "string" && apiKey.length > 0) update.trustpilotApiKeyEncrypted = encrypt(apiKey);
  if (typeof inviteDelayDays === "number" && inviteDelayDays >= 1 && inviteDelayDays <= 30) update.trustpilotInviteDelayDays = inviteDelayDays;
  if (typeof cachedRating === "number" && cachedRating >= 0 && cachedRating <= 5) update.trustpilotCachedRating = cachedRating.toFixed(1);
  if (typeof cachedCount === "number" && cachedCount >= 0) update.trustpilotCachedCount = Math.round(cachedCount);

  const rows = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1);
  if (rows.length === 0) {
    await db.insert(siteSettings).values(update);
  } else {
    await db.update(siteSettings).set(update);
  }
  res.json({ ok: true });
});

router.post("/admin/trustpilot/test-invite", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) { res.status(400).json({ error: "Email and name required" }); return; }

  const rows = await db.select().from(siteSettings);
  if (!rows.length || !rows[0].trustpilotApiKeyEncrypted || !rows[0].trustpilotBusinessUnitId) {
    res.status(400).json({ error: "Trustpilot API key and Business Unit ID required" }); return;
  }

  try {
    const apiKey = decrypt(rows[0].trustpilotApiKeyEncrypted);
    const buid = rows[0].trustpilotBusinessUnitId;
    const response = await fetch(`https://invitations-api.trustpilot.com/v1/private/business-units/${buid}/email-invitations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        consumerEmail: email,
        consumerName: name,
        referenceNumber: `TEST-${Date.now()}`,
        locale: "en-US",
        senderEmail: rows[0].fromEmail || "noreply@pixelcodes.com",
        senderName: rows[0].siteName || "PixelCodes",
        replyTo: rows[0].supportEmail || rows[0].contactEmail || "support@pixelcodes.com",
        serviceReviewInvitation: { templateId: "default", redirectUri: rows[0].trustpilotUrl || "https://pixelcodes.com" },
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({ error: `Trustpilot API error: ${err}` }); return;
    }
    res.json({ ok: true, message: "Test invite sent successfully" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send invite" });
  }
});

router.post("/admin/trustpilot/clear-api-key", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  await db.update(siteSettings).set({ trustpilotApiKeyEncrypted: null, updatedAt: new Date() });
  res.json({ ok: true });
});

export default router;
