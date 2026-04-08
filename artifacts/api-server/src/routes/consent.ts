import { Router } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { consentLogs, seoTracking } from "@workspace/db/schema";
import { desc, sql } from "drizzle-orm";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

const VALID_ACTIONS = ["accept_all", "reject_all", "customize"];

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.ENCRYPTION_KEY || "salt")).digest("hex").slice(0, 64);
}

router.post("/consent/log", optionalAuth, async (req, res) => {
  try {
    const { necessary, analytics, marketing, preferences, consentAction } = req.body;
    if (!consentAction || typeof consentAction !== "string" || !VALID_ACTIONS.includes(consentAction)) {
      return res.status(400).json({ error: "Invalid consentAction" });
    }

    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const userId = req.user?.userId || null;

    await db.insert(consentLogs).values({
      userId,
      ipHash: hashIp(ip),
      userAgent: (req.headers["user-agent"] || "").slice(0, 500),
      necessary: necessary !== false,
      analytics: !!analytics,
      marketing: !!marketing,
      preferences: !!preferences,
      consentAction,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to log consent" });
  }
});

router.get("/consent/tracking-ids", async (_req, res) => {
  try {
    const rows = await db.select({
      googleAnalyticsId: seoTracking.googleAnalyticsId,
      facebookPixelId: seoTracking.facebookPixelId,
    }).from(seoTracking).limit(1);
    const seo = rows[0];
    res.json({
      gaId: seo?.googleAnalyticsId || null,
      fbPixelId: seo?.facebookPixelId || null,
    });
  } catch {
    res.json({ gaId: null, fbPixelId: null });
  }
});

const auth = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/consent/logs", ...auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const [logs, countResult] = await Promise.all([
      db.select().from(consentLogs).orderBy(desc(consentLogs.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(consentLogs),
    ]);

    res.json({
      logs,
      total: countResult[0]?.count || 0,
      page,
      totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch consent logs" });
  }
});

router.get("/admin/consent/stats", ...auth, async (_req, res) => {
  try {
    const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(consentLogs);
    const [analytics] = await db.select({ count: sql<number>`count(*)::int` }).from(consentLogs)
      .where(sql`${consentLogs.analytics} = true`);
    const [marketing] = await db.select({ count: sql<number>`count(*)::int` }).from(consentLogs)
      .where(sql`${consentLogs.marketing} = true`);
    const [preferences] = await db.select({ count: sql<number>`count(*)::int` }).from(consentLogs)
      .where(sql`${consentLogs.preferences} = true`);

    res.json({
      total: total?.count || 0,
      analytics: analytics?.count || 0,
      marketing: marketing?.count || 0,
      preferences: preferences?.count || 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch consent stats" });
  }
});

export default router;
