import { Router } from "express";
import { db } from "@workspace/db";
import { newsletterSubscribers, newsletterSettings, coupons } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { z } from "zod";
import crypto from "crypto";
import { enqueueEmail } from "../lib/email/queue";
import { confirmationEmail, welcomeEmail } from "../services/newsletter-emails";

const router = Router();

async function getSettings() {
  let [settings] = await db.select().from(newsletterSettings);
  if (!settings) {
    [settings] = await db.insert(newsletterSettings).values({}).returning();
  }
  return settings;
}

function genToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function getBaseUrl(): string {
  return process.env.APP_PUBLIC_URL ?? `https://${process.env["REPLIT_DEV_DOMAIN"] ?? "localhost"}`;
}

const subscribeSchema = z.object({
  email: z.string().email(),
  source: z.enum(["footer", "exit_intent", "checkout", "account"]).default("footer"),
});

router.post("/newsletter/subscribe", optionalAuth, async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid email" }); return; }

  const settings = await getSettings();
  if (!settings.enabled) { res.status(400).json({ error: "Newsletter is not active" }); return; }

  const { email, source } = parsed.data;
  const userId = req.user?.userId ?? null;

  const [existing] = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase()));

  if (existing) {
    if (existing.status === "CONFIRMED") {
      res.json({ success: true, message: "You are already subscribed!" });
      return;
    }
    if (existing.status === "UNSUBSCRIBED") {
      const confirmToken = genToken();
      const unsubToken = genToken();
      const newStatus = settings.doubleOptIn ? "PENDING" : "CONFIRMED";
      await db.update(newsletterSubscribers).set({
        status: newStatus, confirmToken, unsubToken, source,
        userId: userId ?? existing.userId,
        confirmedAt: settings.doubleOptIn ? null : new Date(),
        unsubscribedAt: null,
        updatedAt: new Date(),
      }).where(eq(newsletterSubscribers.id, existing.id));

      if (settings.doubleOptIn) {
        const confirmUrl = `${getBaseUrl()}/newsletter/confirm?token=${confirmToken}`;
        const { subject, html } = confirmationEmail({ confirmUrl });
        await enqueueEmail(email, subject, html, { type: "newsletter_confirm" });
      } else {
        const unsubUrl = `${getBaseUrl()}/newsletter/unsubscribe?token=${unsubToken}`;
        const { subject, html } = welcomeEmail({ unsubUrl });
        await enqueueEmail(email, subject, html, { type: "newsletter_welcome" });
      }
      res.json({ success: true, message: settings.doubleOptIn ? "Please check your email to confirm." : "Subscribed!" });
      return;
    }
    if (existing.status === "PENDING") {
      res.json({ success: true, message: "Please check your email to confirm your subscription." });
      return;
    }
  }

  const confirmToken = genToken();
  const unsubToken = genToken();
  let discountCode: string | undefined;

  if (source === "exit_intent" && settings.exitIntentDiscount > 0) {
    discountCode = `NL${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await db.insert(coupons).values({
      code: discountCode,
      discountType: "PERCENTAGE",
      discountValue: String(settings.exitIntentDiscount),
      usageLimit: 1,
      usedCount: 0,
      isActive: true,
      singleUsePerCustomer: true,
    });
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || null;

  await db.insert(newsletterSubscribers).values({
    email: email.toLowerCase(),
    status: settings.doubleOptIn ? "PENDING" : "CONFIRMED",
    userId,
    source,
    confirmToken,
    unsubToken,
    discountCode: discountCode || null,
    ipAddress: ip,
    confirmedAt: settings.doubleOptIn ? null : new Date(),
  });

  if (settings.doubleOptIn) {
    const confirmUrl = `${getBaseUrl()}/newsletter/confirm?token=${confirmToken}`;
    const { subject, html } = confirmationEmail({ confirmUrl });
    await enqueueEmail(email, subject, html, { type: "newsletter_confirm" });
    res.json({ success: true, message: "Please check your email to confirm your subscription." });
  } else {
    const unsubUrl = `${getBaseUrl()}/newsletter/unsubscribe?token=${unsubToken}`;
    const { subject, html } = welcomeEmail({ discountCode, unsubUrl });
    await enqueueEmail(email, subject, html, { type: "newsletter_welcome" });
    res.json({ success: true, message: "Subscribed!", discountCode });
  }
});

router.get("/newsletter/confirm", async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }

  const [sub] = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.confirmToken, token));
  if (!sub) { res.status(404).json({ error: "Invalid or expired link" }); return; }
  if (sub.status === "CONFIRMED") { res.json({ success: true, message: "Already confirmed" }); return; }

  await db.update(newsletterSubscribers).set({
    status: "CONFIRMED", confirmedAt: new Date(), updatedAt: new Date(),
  }).where(eq(newsletterSubscribers.id, sub.id));

  const unsubUrl = `${getBaseUrl()}/newsletter/unsubscribe?token=${sub.unsubToken}`;
  const { subject, html } = welcomeEmail({ discountCode: sub.discountCode || undefined, unsubUrl });
  await enqueueEmail(sub.email, subject, html, { type: "newsletter_welcome" });

  res.json({ success: true, message: "Subscription confirmed!", discountCode: sub.discountCode || undefined });
});

router.get("/newsletter/unsubscribe", async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: "Missing token" }); return; }

  const [sub] = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.unsubToken, token));
  if (!sub) { res.status(404).json({ error: "Invalid link" }); return; }

  await db.update(newsletterSubscribers).set({
    status: "UNSUBSCRIBED", unsubscribedAt: new Date(), updatedAt: new Date(),
  }).where(eq(newsletterSubscribers.id, sub.id));

  res.json({ success: true, message: "You have been unsubscribed." });
});

router.post("/newsletter/unsubscribe-account", requireAuth, async (req, res) => {
  const userEmail = req.user?.email;
  const { email } = req.body;
  if (!email || email.toLowerCase() !== userEmail?.toLowerCase()) {
    res.status(403).json({ error: "You can only unsubscribe your own email." });
    return;
  }

  const [sub] = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase()));
  if (!sub || sub.status !== "CONFIRMED") {
    res.json({ success: true, message: "Not subscribed." });
    return;
  }

  await db.update(newsletterSubscribers).set({
    status: "UNSUBSCRIBED", unsubscribedAt: new Date(), updatedAt: new Date(),
  }).where(eq(newsletterSubscribers.id, sub.id));

  res.json({ success: true, message: "Unsubscribed successfully." });
});

router.get("/newsletter/status", async (req, res) => {
  const email = req.query.email as string;
  if (!email) { res.json({ subscribed: false }); return; }
  const [sub] = await db.select({ status: newsletterSubscribers.status })
    .from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email.toLowerCase()));
  res.json({ subscribed: sub?.status === "CONFIRMED" });
});

router.get("/newsletter/settings/public", async (_req, res) => {
  const settings = await getSettings();
  res.json({
    enabled: settings.enabled,
    exitIntentEnabled: settings.exitIntentEnabled,
    exitIntentHeadline: settings.exitIntentHeadline,
    exitIntentBody: settings.exitIntentBody,
    exitIntentDiscount: settings.exitIntentDiscount,
  });
});

export default router;
