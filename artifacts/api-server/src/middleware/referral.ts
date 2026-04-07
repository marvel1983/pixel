import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { affiliateProfiles, affiliateClicks, affiliateSettings } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export function referralTracking(req: Request, res: Response, next: NextFunction) {
  const refCode = req.query.ref as string | undefined;

  if (refCode && typeof refCode === "string" && refCode.length >= 3) {
    handleReferral(req, res, refCode).catch((err) => {
      logger.error({ err }, "Referral tracking error (non-fatal)");
    });
  }

  next();
}

async function handleReferral(_req: Request, res: Response, refCode: string) {
  const [settings] = await db.select().from(affiliateSettings);
  if (!settings?.enabled) return;

  const [affiliate] = await db.select({ id: affiliateProfiles.id })
    .from(affiliateProfiles)
    .where(and(
      eq(affiliateProfiles.referralCode, refCode),
      eq(affiliateProfiles.status, "APPROVED"),
    ));

  if (!affiliate) return;

  const cookieDays = settings.cookieDurationDays || 30;
  res.cookie("ref", refCode, {
    maxAge: cookieDays * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  await db.insert(affiliateClicks).values({
    affiliateId: affiliate.id,
    ipAddress: (_req.headers["x-forwarded-for"] as string)?.split(",")[0] || _req.ip || null,
    userAgent: _req.headers["user-agent"] || null,
    referrerUrl: _req.headers.referer || null,
    landingPage: _req.originalUrl,
  });

  await db.update(affiliateProfiles)
    .set({ totalClicks: sql`${affiliateProfiles.totalClicks} + 1` })
    .where(eq(affiliateProfiles.id, affiliate.id));
}

export function getRefCookie(req: Request): string | undefined {
  return req.cookies?.ref as string | undefined;
}
