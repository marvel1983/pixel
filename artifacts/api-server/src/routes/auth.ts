import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { users, passwordResets, type User } from "@workspace/db/schema";
import { signToken, requireAuth, type JwtPayload } from "../middleware/auth";
import { logger } from "../lib/logger";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";
import crypto from "node:crypto";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  agreeTerms: z.literal(true, {
    message: "You must agree to the terms",
  }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function sanitizeUser(u: User) {
  return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role, avatarUrl: u.avatarUrl, emailVerified: u.emailVerified, googleId: u.googleId, createdAt: u.createdAt };
}

function makeToken(u: User) {
  const payload: JwtPayload = { userId: u.id, email: u.email, role: u.role };
  return signToken(payload);
}

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, password, firstName, lastName } = parsed.data;

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
    })
    .returning();

  const token = makeToken(user);
  res.cookie("token", token, COOKIE_OPTS);
  logger.info({ userId: user.id }, "User registered");

  sendWelcomeEmail(user.email, firstName).catch((err) =>
    logger.error({ err, userId: user.id }, "Failed to enqueue welcome email"),
  );

  res.status(201).json({ user: sanitizeUser(user), token });
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const { email, password } = parsed.data;

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

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const token = makeToken(user);
  res.cookie("token", token, COOKIE_OPTS);
  logger.info({ userId: user.id }, "User logged in");
  res.json({ user: sanitizeUser(user), token });
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

router.put("/auth/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { firstName, lastName, currentPassword, newPassword } = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password required to change password" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, req.user!.userId))
    .returning();

  res.json({ user: sanitizeUser(updated) });
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.post("/auth/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.json({ ok: true });
    return;
  }

  const [user] = await db
    .select({ id: users.id, firstName: users.firstName })
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase()))
    .limit(1);

  let resetToken: string | undefined;

  if (user) {
    resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHashed = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash: tokenHashed,
      expiresAt,
    });

    const baseUrl = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    sendPasswordResetEmail(parsed.data.email.toLowerCase(), {
      firstName: user.firstName ?? "there",
      resetLink,
      expiresIn: "1 hour",
    }).catch((err) =>
      logger.error({ err, userId: user.id }, "Failed to enqueue reset email"),
    );

    logger.info({ userId: user.id }, "Password reset requested");
  }

  res.json({ ok: true, resetToken });
});

router.post("/auth/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Token and new password are required" });
    return;
  }

  const tokenHashed = hashToken(parsed.data.token);

  const [entry] = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, tokenHashed),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!entry) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, entry.userId));

    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(passwordResets.id, entry.id));
  });

  logger.info({ userId: entry.userId }, "Password reset completed");
  res.json({ ok: true });
});

export default router;
