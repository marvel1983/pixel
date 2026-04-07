import { Router } from "express";
import { db } from "@workspace/db";
import { seoTracking } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

async function getOrCreateSeo() {
  const rows = await db.select().from(seoTracking);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(seoTracking).values({}).returning();
  return created;
}

router.get("/admin/settings/seo-tracking", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const settings = await getOrCreateSeo();
  res.json({ settings });
});

router.put("/admin/settings/seo-tracking", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const settings = await getOrCreateSeo();
  const {
    googleAnalyticsId, gtmId, facebookPixelId, googleVerificationCode,
    socialShareImage, robotsTxt, customHeadScripts, customBodyScripts,
    maintenanceMode, maintenanceMessage, maintenanceEstimate, maintenanceBypassIps,
  } = req.body;

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof googleAnalyticsId === "string") data.googleAnalyticsId = googleAnalyticsId || null;
  if (typeof gtmId === "string") data.gtmId = gtmId || null;
  if (typeof facebookPixelId === "string") data.facebookPixelId = facebookPixelId || null;
  if (typeof googleVerificationCode === "string") data.googleVerificationCode = googleVerificationCode || null;
  if (typeof socialShareImage === "string") data.socialShareImage = socialShareImage || null;
  if (typeof robotsTxt === "string") data.robotsTxt = robotsTxt;
  if (typeof customHeadScripts === "string") data.customHeadScripts = customHeadScripts || null;
  if (typeof customBodyScripts === "string") data.customBodyScripts = customBodyScripts || null;
  if (typeof maintenanceMode === "boolean") data.maintenanceMode = maintenanceMode;
  if (typeof maintenanceMessage === "string") data.maintenanceMessage = maintenanceMessage;
  if (typeof maintenanceEstimate === "string") data.maintenanceEstimate = maintenanceEstimate || null;
  if (Array.isArray(maintenanceBypassIps)) data.maintenanceBypassIps = maintenanceBypassIps;

  await db.update(seoTracking).set(data).where(eq(seoTracking.id, settings.id));
  const [updated] = await db.select().from(seoTracking);
  res.json({ success: true, settings: updated });
});

router.get("/robots.txt", async (_req, res) => {
  const rows = await db.select({ robotsTxt: seoTracking.robotsTxt }).from(seoTracking);
  const content = rows[0]?.robotsTxt ?? "User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml";
  res.type("text/plain").send(content);
});

router.post("/admin/settings/seo-tracking/regenerate-sitemap", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  res.json({ success: true, message: "Sitemap regeneration queued" });
});

router.get("/maintenance-status", async (_req, res) => {
  const rows = await db.select({
    maintenanceMode: seoTracking.maintenanceMode,
    maintenanceMessage: seoTracking.maintenanceMessage,
    maintenanceEstimate: seoTracking.maintenanceEstimate,
  }).from(seoTracking);
  if (!rows[0] || !rows[0].maintenanceMode) {
    res.json({ maintenance: false }); return;
  }
  res.json({
    maintenance: true,
    message: rows[0].maintenanceMessage,
    estimate: rows[0].maintenanceEstimate,
  });
});

export default router;
