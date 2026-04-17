import { Router } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { consentLogs, seoTracking, consentConfig } from "@workspace/db/schema";
import { desc, sql, eq } from "drizzle-orm";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";

const router = Router();

const VALID_ACTIONS = ["accept_all", "reject_all", "customize"];

async function getOrCreateConfig() {
  const rows = await db.select().from(consentConfig);
  if (rows.length > 0) return rows[0];
  const [created] = await db.insert(consentConfig).values({}).returning();
  return created;
}

function hashIp(ip: string): string {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return createHash("sha256").update(ip).digest("hex").slice(0, 16);
  return createHash("sha256").update(ip + secret).digest("hex").slice(0, 64);
}

router.post("/consent/log", optionalAuth, async (req, res) => {
  try {
    const { necessary, analytics, marketing, preferences, consentAction } = req.body;
    if (!consentAction || typeof consentAction !== "string" || !VALID_ACTIONS.includes(consentAction)) {
      res.status(400).json({ error: "Invalid consentAction" }); return;
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

router.get("/consent/config", async (_req, res) => {
  try {
    const cfg = await getOrCreateConfig();
    const { id, updatedAt, ...rest } = cfg;
    res.json(rest);
  } catch {
    res.json({ bannerTitle: "We value your privacy" });
  }
});

router.get("/admin/consent/config", ...auth, async (_req, res) => {
  try { res.json({ config: await getOrCreateConfig() }); } catch { res.status(500).json({ error: "Failed" }); }
});

router.put("/admin/consent/config", ...auth, async (req, res) => {
  try {
    const cfg = await getOrCreateConfig();
    const fields = [
      "bannerTitle", "bannerText", "privacyPolicyUrl", "acceptAllLabel", "rejectAllLabel",
      "customizeLabel", "savePrefsLabel", "necessaryLabel", "necessaryDesc", "analyticsLabel",
      "analyticsDesc", "marketingLabel", "marketingDesc", "preferencesLabel", "preferencesDesc",
    ] as const;
    const data: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of fields) {
      if (typeof req.body[f] === "string") data[f] = req.body[f].slice(0, f.endsWith("Desc") || f === "bannerText" ? 1000 : 200);
    }
    await db.update(consentConfig).set(data).where(eq(consentConfig.id, cfg.id));
    res.json({ success: true, config: await getOrCreateConfig() });
  } catch { res.status(500).json({ error: "Failed to update config" }); }
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
