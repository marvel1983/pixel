import { Router } from "express";
import { db } from "@workspace/db";
import {
  affiliateProfiles,
  affiliateCommissions,
  affiliateSettings,
  users,
} from "@workspace/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

function generateRefCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/affiliate-track", async (req, res) => {
  const { code } = req.body;
  if (!code) { res.json({ tracked: false }); return; }

  const [settings] = await db.select().from(affiliateSettings);
  if (!settings?.enabled) { res.json({ tracked: false }); return; }

  const [affiliate] = await db.select({ id: affiliateProfiles.id })
    .from(affiliateProfiles)
    .where(and(eq(affiliateProfiles.referralCode, code), eq(affiliateProfiles.status, "APPROVED")));
  if (!affiliate) { res.json({ tracked: false }); return; }

  const cookieDays = settings.cookieDurationDays || 30;
  res.cookie("ref", code, {
    maxAge: cookieDays * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  await db.update(affiliateProfiles)
    .set({ totalClicks: sql`${affiliateProfiles.totalClicks} + 1` })
    .where(eq(affiliateProfiles.id, affiliate.id));
  await db.insert(affiliateClicks).values({
    affiliateId: affiliate.id,
    ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || null,
    userAgent: req.headers["user-agent"] || null,
    referrerUrl: req.headers.referer || null,
    landingPage: req.body.landingPage || "/",
  });

  res.json({ tracked: true });
});

router.get("/affiliate-settings/public", async (_req, res) => {
  const [settings] = await db.select().from(affiliateSettings);
  if (!settings?.enabled) {
    res.json({ enabled: false });
    return;
  }
  res.json({
    enabled: true,
    defaultCommissionRate: settings.defaultCommissionRate,
    minimumPayout: settings.minimumPayout,
    cookieDurationDays: settings.cookieDurationDays,
    programDescription: settings.programDescription,
    termsAndConditions: settings.termsAndConditions,
  });
});

const applySchema = z.object({
  websiteUrl: z.string().max(500).optional(),
  socialMedia: z.string().max(500).optional(),
  promotionMethod: z.string().min(10).max(1000),
  paypalEmail: z.string().email().optional(),
});

router.post("/affiliates/apply", requireAuth, async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid application data" }); return; }

  const userId = req.user!.userId;
  const [existing] = await db.select({ id: affiliateProfiles.id })
    .from(affiliateProfiles).where(eq(affiliateProfiles.userId, userId));
  if (existing) { res.status(400).json({ error: "You already have an affiliate application" }); return; }

  const [settings] = await db.select().from(affiliateSettings);
  if (!settings?.enabled) { res.status(400).json({ error: "Affiliate program is not active" }); return; }

  const refCode = generateRefCode();
  const status = settings.autoApprove ? "APPROVED" : "PENDING";

  const [profile] = await db.insert(affiliateProfiles).values({
    userId,
    referralCode: refCode,
    status,
    commissionRate: settings.defaultCommissionRate,
    websiteUrl: parsed.data.websiteUrl || null,
    socialMedia: parsed.data.socialMedia || null,
    promotionMethod: parsed.data.promotionMethod,
    paypalEmail: parsed.data.paypalEmail || null,
    approvedAt: status === "APPROVED" ? new Date() : null,
  }).returning();

  res.status(201).json({ profile });
});

router.get("/account/affiliate", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [profile] = await db.select().from(affiliateProfiles)
    .where(eq(affiliateProfiles.userId, userId));
  if (!profile) { res.json({ profile: null }); return; }

  const commissions = await db.select().from(affiliateCommissions)
    .where(eq(affiliateCommissions.affiliateId, profile.id))
    .orderBy(desc(affiliateCommissions.createdAt))
    .limit(50);

  res.json({ profile, commissions });
});

router.post("/account/affiliate/payout", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [profile] = await db.select().from(affiliateProfiles)
    .where(and(eq(affiliateProfiles.userId, userId), eq(affiliateProfiles.status, "APPROVED")));
  if (!profile) { res.status(404).json({ error: "Affiliate profile not found" }); return; }

  const [settings] = await db.select().from(affiliateSettings);
  const minPayout = parseFloat(settings?.minimumPayout || "25.00");
  const available = parseFloat(profile.totalEarned) - parseFloat(profile.totalPaid);
  if (available < minPayout) {
    res.status(400).json({ error: `Minimum payout is $${minPayout}. Your available balance is $${available.toFixed(2)}` });
    return;
  }

  res.json({ message: "Payout request submitted. Admin will process it manually.", available: available.toFixed(2) });
});

export default router;
