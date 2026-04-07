import { Router } from "express";
import { db } from "@workspace/db";
import { apiProviders } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getMetenziConfig } from "../lib/metenzi-config";
import { getBalance, listWebhooks, listClaims } from "../lib/metenzi-endpoints";

const router = Router();

router.get("/admin/metenzi/balance", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.json({ configured: false }); return; }
  try {
    const balance = await getBalance(config);
    res.json({ configured: true, balance: balance.balanceUsd, currency: balance.currency ?? "USD" });
  } catch (e) { res.json({ configured: true, error: (e as Error).message }); }
});

router.get("/admin/metenzi/status", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const config = await getMetenziConfig();
  if (!config) { res.json({ configured: false }); return; }
  const [provider] = await db.select({ updatedAt: apiProviders.updatedAt, isActive: apiProviders.isActive }).from(apiProviders).where(eq(apiProviders.slug, "metenzi"));

  let webhookCount = 0;
  let activeWebhooks = 0;
  let claimsSummary = { total: 0, pending: 0 };
  try {
    const webhooks = await listWebhooks(config);
    webhookCount = webhooks.length;
    activeWebhooks = webhooks.filter((w) => w.isActive).length;
  } catch { /* ignore */ }
  try {
    const claims = await listClaims(config);
    claimsSummary = { total: claims.length, pending: claims.filter((c) => c.status === "pending").length };
  } catch { /* ignore */ }

  res.json({
    configured: true,
    isActive: provider?.isActive ?? false,
    lastSync: provider?.updatedAt ?? null,
    webhooks: { total: webhookCount, active: activeWebhooks },
    claims: claimsSummary,
  });
});

router.get("/admin/metenzi/key-rotation", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const [provider] = await db.select({ updatedAt: apiProviders.updatedAt }).from(apiProviders).where(eq(apiProviders.slug, "metenzi"));
  if (!provider) { res.json({ lastRotated: null, daysSinceRotation: null }); return; }
  const days = Math.floor((Date.now() - new Date(provider.updatedAt).getTime()) / 86400000);
  res.json({ lastRotated: provider.updatedAt, daysSinceRotation: days, needsRotation: days > 90 });
});

export default router;
