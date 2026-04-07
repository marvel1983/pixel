import { Router } from "express";
import { db } from "@workspace/db";
import { notificationPreferences } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

async function getOrCreatePrefs() {
  const rows = await db.select().from(notificationPreferences);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(notificationPreferences).values({}).returning();
  return created;
}

router.get("/admin/settings/notifications", requireAuth, requireAdmin, requirePermission("manageSettings"), async (_req, res) => {
  const prefs = await getOrCreatePrefs();
  res.json({ preferences: prefs });
});

router.put("/admin/settings/notifications", requireAuth, requireAdmin, requirePermission("manageSettings"), async (req, res) => {
  const prefs = await getOrCreatePrefs();
  const {
    orderAlerts, orderAlertsEmail, stockAlerts, stockThreshold,
    customerAlerts, reviewAlerts, reviewMinRating,
    claimAlerts, paymentAlerts, paymentFailedOnly,
    systemAlerts, dailyDigest, dailyDigestTime, dailyDigestRecipients,
  } = req.body;

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof orderAlerts === "boolean") data.orderAlerts = orderAlerts;
  if (typeof orderAlertsEmail === "boolean") data.orderAlertsEmail = orderAlertsEmail;
  if (typeof stockAlerts === "boolean") data.stockAlerts = stockAlerts;
  if (typeof stockThreshold === "string") data.stockThreshold = stockThreshold;
  if (typeof customerAlerts === "boolean") data.customerAlerts = customerAlerts;
  if (typeof reviewAlerts === "boolean") data.reviewAlerts = reviewAlerts;
  if (typeof reviewMinRating === "string") data.reviewMinRating = reviewMinRating;
  if (typeof claimAlerts === "boolean") data.claimAlerts = claimAlerts;
  if (typeof paymentAlerts === "boolean") data.paymentAlerts = paymentAlerts;
  if (typeof paymentFailedOnly === "boolean") data.paymentFailedOnly = paymentFailedOnly;
  if (typeof systemAlerts === "boolean") data.systemAlerts = systemAlerts;
  if (typeof dailyDigest === "boolean") data.dailyDigest = dailyDigest;
  if (typeof dailyDigestTime === "string") data.dailyDigestTime = dailyDigestTime;
  if (Array.isArray(dailyDigestRecipients)) {
    data.dailyDigestRecipients = dailyDigestRecipients.filter(
      (e: unknown) => typeof e === "string" && e.includes("@") && e.length <= 255
    );
  }

  await db.update(notificationPreferences).set(data)
    .where(eq(notificationPreferences.id, prefs.id));

  const [updated] = await db.select().from(notificationPreferences);
  res.json({ success: true, preferences: updated });
});

export default router;
