import { Router } from "express";
import { db } from "@workspace/db";
import { trackingProviders, TRACKING_PROVIDER_TYPES, type TrackingProviderType } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

// Public — storefront fetches this to inject scripts
router.get("/tracking/active", async (_req, res) => {
  const rows = await db
    .select({ type: trackingProviders.type, trackingId: trackingProviders.trackingId })
    .from(trackingProviders)
    .where(eq(trackingProviders.isEnabled, true));
  res.json({ providers: rows });
});

// Admin — list all configured providers
router.get("/admin/tracking", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const rows = await db.select().from(trackingProviders);
  res.json({ providers: rows });
});

// Admin — upsert a provider
router.put("/admin/tracking/:type", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const type = req.params.type as TrackingProviderType;
  if (!TRACKING_PROVIDER_TYPES.includes(type)) {
    res.status(400).json({ error: `Invalid provider type. Must be one of: ${TRACKING_PROVIDER_TYPES.join(", ")}` });
    return;
  }
  const { trackingId, isEnabled } = req.body;
  if (typeof trackingId !== "string" || !trackingId.trim()) {
    res.status(400).json({ error: "trackingId is required" });
    return;
  }
  const now = new Date();
  await db
    .insert(trackingProviders)
    .values({ type, trackingId: trackingId.trim(), isEnabled: isEnabled !== false, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: trackingProviders.type,
      set: { trackingId: trackingId.trim(), isEnabled: isEnabled !== false, updatedAt: now },
    });
  res.json({ success: true });
});

// Admin — delete a provider
router.delete("/admin/tracking/:type", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const type = req.params.type as TrackingProviderType;
  if (!TRACKING_PROVIDER_TYPES.includes(type)) {
    res.status(400).json({ error: "Invalid provider type" });
    return;
  }
  await db.delete(trackingProviders).where(eq(trackingProviders.type, type));
  res.json({ success: true });
});

export default router;
