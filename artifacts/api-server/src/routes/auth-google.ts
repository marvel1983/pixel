import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { users, siteSettings } from "@workspace/db/schema";
import { signToken, requireAuth, type JwtPayload } from "../middleware/auth";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import crypto from "node:crypto";

const router = Router();

const PLACEHOLDER_PREFIX = "GOOGLE_OAUTH_NO_PASSWORD::";

const pendingCodes = new Map<string, { user: object; token: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingCodes) {
    if (v.expiresAt < now) pendingCodes.delete(k);
  }
}, 60_000);

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

async function getGoogleConfig() {
  const [settings] = await db
    .select({
      enabled: siteSettings.googleOAuthEnabled,
      clientId: siteSettings.googleClientId,
      clientSecret: siteSettings.googleClientSecret,
    })
    .from(siteSettings)
    .limit(1);
  if (!settings?.enabled || !settings.clientId || !settings.clientSecret) return null;
  return {
    clientId: settings.clientId,
    clientSecret: decrypt(settings.clientSecret),
  };
}

function getRedirectUri() {
  const base = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
  return `${base}/api/auth/google/callback`;
}

function sanitizeUser(u: typeof users.$inferSelect) {
  return {
    id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
    role: u.role, avatarUrl: u.avatarUrl, emailVerified: u.emailVerified,
    googleId: u.googleId, createdAt: u.createdAt, preferredLocale: u.preferredLocale,
  };
}

function makeToken(u: typeof users.$inferSelect) {
  const payload: JwtPayload = { userId: u.id, email: u.email, role: u.role };
  return signToken(payload);
}

function isPlaceholderPassword(hash: string): boolean {
  return hash.startsWith(PLACEHOLDER_PREFIX);
}

router.get("/auth/google/enabled", async (_req, res) => {
  const config = await getGoogleConfig();
  res.json({ enabled: !!config, clientId: config?.clientId ?? null });
});

router.get("/auth/google", async (req, res) => {
  const config = await getGoogleConfig();
  if (!config) { res.status(400).json({ error: "Google OAuth not configured" }); return; }

  const state = crypto.randomBytes(16).toString("hex");
  const mode = req.query.mode === "link" ? "link" : "login";
  res.cookie("google_oauth_state", `${state}:${mode}`, {
    httpOnly: true, secure: COOKIE_OPTS.secure, sameSite: "lax", maxAge: 600000,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/auth/google/callback", async (req, res) => {
  const baseUrl = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
  const errorRedirect = (msg: string) => res.redirect(`${baseUrl}/login?error=${encodeURIComponent(msg)}`);

  const { code, state } = req.query;
  if (!code || !state) return errorRedirect("Missing authorization code");

  const savedState = req.cookies?.google_oauth_state ?? "";
  const [expectedState, mode] = savedState.split(":");
  res.clearCookie("google_oauth_state");
  if (state !== expectedState) return errorRedirect("Invalid state parameter");

  const config = await getGoogleConfig();
  if (!config) return errorRedirect("Google OAuth not configured");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code as string,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: getRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return errorRedirect("Failed to exchange code");

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profile.id || !profile.email) return errorRedirect("Failed to get Google profile");

    if (mode === "link") {
      return handleLink(req, res, profile, baseUrl);
    }
    return handleLoginOrRegister(res, profile, baseUrl);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    return errorRedirect("Google authentication failed");
  }
});

router.get("/auth/google/exchange", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) { res.status(400).json({ error: "Missing code" }); return; }

  const entry = pendingCodes.get(code);
  pendingCodes.delete(code);
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(400).json({ error: "Invalid or expired code" });
    return;
  }

  res.cookie("token", entry.token, COOKIE_OPTS);
  res.json({ user: entry.user, token: entry.token });
});

async function handleLoginOrRegister(
  res: import("express").Response,
  profile: { id: string; email: string; name?: string; given_name?: string; family_name?: string; picture?: string },
  baseUrl: string,
) {
  let [user] = await db.select().from(users).where(eq(users.googleId, profile.id)).limit(1);

  if (!user) {
    [user] = await db.select().from(users).where(eq(users.email, profile.email.toLowerCase())).limit(1);
    if (user) {
      if (!user.isActive) {
        return res.redirect(`${baseUrl}/login?error=${encodeURIComponent("Account deactivated")}`);
      }
      await db.update(users).set({
        googleId: profile.id, emailVerified: true, lastLoginAt: new Date(), updatedAt: new Date(),
        avatarUrl: user.avatarUrl ?? profile.picture ?? null,
      }).where(eq(users.id, user.id));
      [user] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    }
  }

  if (!user) {
    const placeholder = PLACEHOLDER_PREFIX + crypto.randomBytes(32).toString("hex");
    [user] = await db.insert(users).values({
      email: profile.email.toLowerCase(),
      passwordHash: placeholder,
      firstName: profile.given_name ?? profile.name ?? null,
      lastName: profile.family_name ?? null,
      avatarUrl: profile.picture ?? null,
      googleId: profile.id,
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
    }).returning();
    logger.info({ userId: user.id }, "User registered via Google");
  } else {
    if (!user.isActive) {
      return res.redirect(`${baseUrl}/login?error=${encodeURIComponent("Account deactivated")}`);
    }
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  }

  const token = makeToken(user);
  const oneTimeCode = crypto.randomBytes(24).toString("hex");
  pendingCodes.set(oneTimeCode, {
    user: sanitizeUser(user),
    token,
    expiresAt: Date.now() + 60_000,
  });
  res.cookie("token", token, COOKIE_OPTS);
  res.redirect(`${baseUrl}/auth/google/success?code=${oneTimeCode}`);
}

async function handleLink(
  req: import("express").Request, res: import("express").Response,
  profile: { id: string; email: string; picture?: string }, baseUrl: string,
) {
  const authToken = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!authToken) return res.redirect(`${baseUrl}/account?error=auth`);

  try {
    const { verifyToken } = await import("../middleware/auth");
    const decoded = verifyToken(authToken);
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.googleId, profile.id)).limit(1);
    if (existing && existing.id !== decoded.userId) {
      return res.redirect(`${baseUrl}/account?tab=connected&error=${encodeURIComponent("Google account linked to another user")}`);
    }
    await db.update(users).set({ googleId: profile.id, updatedAt: new Date() }).where(eq(users.id, decoded.userId));
    return res.redirect(`${baseUrl}/account?tab=connected&success=linked`);
  } catch {
    return res.redirect(`${baseUrl}/account?error=auth`);
  }
}

router.post("/auth/google/unlink", requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (isPlaceholderPassword(user.passwordHash)) {
    res.status(400).json({ error: "Set a password before unlinking Google" });
    return;
  }

  await db.update(users).set({ googleId: null, updatedAt: new Date() }).where(eq(users.id, user.id));
  res.json({ ok: true });
});

router.post("/auth/set-password", requireAuth, async (req, res) => {
  const schema = z.object({ password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

  const [user] = await db.select({ passwordHash: users.passwordHash, googleId: users.googleId })
    .from(users).where(eq(users.id, req.user!.userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!isPlaceholderPassword(user.passwordHash)) {
    res.status(403).json({ error: "Use profile settings to change an existing password" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, req.user!.userId));
  res.json({ ok: true });
});

router.get("/auth/google/status", requireAuth, async (req, res) => {
  const [user] = await db
    .select({ googleId: users.googleId, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, req.user!.userId))
    .limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.json({ googleLinked: !!user.googleId, hasPassword: !isPlaceholderPassword(user.passwordHash) });
});

export default router;
