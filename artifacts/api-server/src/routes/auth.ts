import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { verifyPasswordAny, getHashFormat } from "../lib/password-verify";
import { db } from "@workspace/db";
import { users, type User } from "@workspace/db/schema";
import { signToken, requireAuth, type JwtPayload } from "../middleware/auth";
import { logger } from "../lib/logger";
import { siteSettings } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";
import { isDisposableEmail } from "../lib/disposable-emails";
import { sendWelcomeEmail } from "../lib/email";
import { awardWelcomeBonus } from "../services/loyalty-service";
import { authLoginLimit, authRegisterLimit } from "../middleware/rate-limit";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  agreeTerms: z.literal(true, {
    message: "You must agree to the terms",
  }),
  billingCountry: z.string().min(2).max(3),
  billingCity: z.string().min(1).max(120),
  billingAddress: z.string().min(1).max(500),
  billingZip: z.string().min(1).max(32),
  billingVatNumber: z.string().max(50).optional(),
  billingPhone: z.string().trim().min(5).max(40),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().nullish(),
});

async function getTurnstileConfig(): Promise<{ enabled: boolean; secretKey: string | null }> {
  try {
    const [s] = await db.select({
      enabled: siteSettings.turnstileEnabled,
      secretKey: siteSettings.turnstileSecretKey,
    }).from(siteSettings).limit(1);
    if (!s || !s.enabled) return { enabled: false, secretKey: null };
    const secretKey = s.secretKey ? decrypt(s.secretKey) : null;
    return { enabled: true, secretKey };
  } catch {
    return { enabled: false, secretKey: null };
  }
}

async function verifyTurnstile(token: string, secretKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true; // Cloudflare error — fail open to preserve availability
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    // Network error or timeout — fail open so Cloudflare outages don't lock out users
    return true;
  }
}

const COOKIE_OPTS = { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax" as const, maxAge: 30 * 24 * 60 * 60 * 1000 };

export function sanitizeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerified,
    googleId: u.googleId,
    createdAt: u.createdAt,
    preferredLocale: u.preferredLocale,
    preferredTheme: u.preferredTheme,
    isBusinessAccount: u.isBusinessAccount,
    businessApproved: u.businessApproved,
    companyName: u.companyName,
    billingCountry: u.billingCountry,
    billingCity: u.billingCity,
    billingAddress: u.billingAddress,
    billingZip: u.billingZip,
    billingVatNumber: u.billingVatNumber,
    billingPhone: u.billingPhone,
  };
}

function makeToken(u: User) {
  return signToken({ userId: u.id, email: u.email, role: u.role } as JwtPayload);
}

router.post("/auth/register", authRegisterLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const {
    email,
    password,
    firstName,
    lastName,
    billingCountry,
    billingCity,
    billingAddress,
    billingZip,
    billingVatNumber,
    billingPhone,
  } = parsed.data;

  if (isDisposableEmail(email)) {
    res.status(400).json({ error: "Disposable email addresses are not allowed. Please use a permanent email." });
    return;
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const locale = typeof req.body.locale === "string" ? req.body.locale.slice(0, 10) : undefined;

  // Resolve referral code if provided
  let referredByUserId: number | undefined;
  const rawReferralCode = typeof req.body.referralCode === "string" ? req.body.referralCode.trim() : undefined;
  if (rawReferralCode && rawReferralCode.toUpperCase().startsWith("REF")) {
    const referrerId = parseInt(rawReferralCode.slice(3), 10);
    if (Number.isInteger(referrerId) && referrerId > 0) {
      const [referrer] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, referrerId))
        .limit(1);
      if (referrer) referredByUserId = referrer.id;
    }
  }

  const vatTrim = billingVatNumber?.trim();

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: "CUSTOMER",
      isActive: true,
      emailVerified: false,
      billingCountry: billingCountry.toUpperCase(),
      billingCity,
      billingAddress,
      billingZip,
      billingVatNumber: vatTrim ? vatTrim : null,
      billingPhone: billingPhone.trim(),
      ...(locale ? { preferredLocale: locale } : {}),
      ...(referredByUserId !== undefined ? { referredByUserId } : {}),
    })
    .returning();

  const token = makeToken(user);
  res.cookie("token", token, COOKIE_OPTS);
  logger.info({ userId: user.id }, "User registered");
  sendWelcomeEmail(user.email, firstName, locale).catch((err) =>
    logger.error({ err, userId: user.id }, "Failed to enqueue welcome email"),
  );
  awardWelcomeBonus(user.id).catch((err) =>
    logger.error({ err, userId: user.id }, "Failed to award welcome bonus (non-fatal)"),
  );

  res.status(201).json({ user: sanitizeUser(user), token });
});

router.post("/auth/login", authLoginLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { email, password, turnstileToken } = parsed.data;

  const turnstileCfg = await getTurnstileConfig();
  if (turnstileCfg.enabled && turnstileCfg.secretKey) {
    if (!turnstileToken) {
      res.status(400).json({ error: "Security check required" });
      return;
    }
    const ok = await verifyTurnstile(turnstileToken, turnstileCfg.secretKey);
    if (!ok) {
      res.status(403).json({ error: "Security check failed. Please try again." });
      return;
    }
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Account has been deactivated" });
    return;
  }

  if (user.passwordHash.startsWith("GOOGLE_OAUTH_NO_PASSWORD::")) {
    res.status(401).json({ error: "This account uses Google sign-in. Use \"Continue with Google\" or set a password in account settings." });
    return;
  }
  const valid = await verifyPasswordAny(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Transparently migrate legacy hashes (phpass etc.) to bcrypt on first login
  if (getHashFormat(user.passwordHash) !== "bcrypt") {
    const newHash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    logger.info({ userId: user.id }, "Migrated legacy password hash to bcrypt");
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const token = makeToken(user);
  res.cookie("token", token, COOKIE_OPTS);
  logger.info({ userId: user.id }, "User logged in");
  res.json({ user: sanitizeUser(user), token });
});

router.get("/auth/turnstile-config", async (_req, res) => {
  try {
    const [s] = await db.select({
      enabled: siteSettings.turnstileEnabled,
      siteKey: siteSettings.turnstileSiteKey,
    }).from(siteSettings).limit(1);
    const enabled = s?.enabled ?? false;
    res.json({ enabled, siteKey: enabled ? (s?.siteKey ?? null) : null });
  } catch {
    res.json({ enabled: false, siteKey: null });
  }
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user: sanitizeUser(user) });
});

export default router;
