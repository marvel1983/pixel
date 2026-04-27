import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import { users, passwordResets } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { sendPasswordResetEmail } from "../lib/email";
import { authPasswordResetLimit } from "../middleware/rate-limit";
import { sanitizeUser } from "./auth";
import crypto from "node:crypto";

const router = Router();

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
  billingCountry: z.string().max(3).optional(),
  billingCity: z.string().max(120).optional(),
  billingAddress: z.string().max(500).optional(),
  billingZip: z.string().max(32).optional(),
  billingVatNumber: z.string().max(50).optional(),
  billingPhone: z.string().trim().max(40).optional(),
});

const forgotPasswordSchema = z.object({ email: z.string().email() });
const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8) });

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

router.put("/auth/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0].message }); return; }

  const { firstName, lastName, currentPassword, newPassword, billingCountry, billingCity, billingAddress, billingZip, billingVatNumber, billingPhone } = parsed.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (billingCountry !== undefined) updateData.billingCountry = billingCountry ? billingCountry.toUpperCase() : null;
  if (billingCity !== undefined) updateData.billingCity = billingCity || null;
  if (billingAddress !== undefined) updateData.billingAddress = billingAddress || null;
  if (billingZip !== undefined) updateData.billingZip = billingZip || null;
  if (billingVatNumber !== undefined) updateData.billingVatNumber = billingVatNumber || null;
  if (billingPhone !== undefined) updateData.billingPhone = billingPhone?.trim() || null;

  if (newPassword) {
    if (!currentPassword) { res.status(400).json({ error: "Current password required to change password" }); return; }
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: "Current password is incorrect" }); return; }
    updateData.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  const [updated] = await db.update(users).set(updateData).where(eq(users.id, req.user!.userId)).returning();
  res.json({ user: sanitizeUser(updated) });
});

router.put("/account/theme", requireAuth, async (req, res) => {
  const theme = req.body?.theme;
  if (theme !== "light" && theme !== "dark") { res.status(400).json({ error: "Invalid theme" }); return; }
  await db.update(users).set({ preferredTheme: theme, updatedAt: new Date() }).where(eq(users.id, req.user!.userId));
  res.json({ success: true });
});

router.post("/auth/forgot-password", authPasswordResetLimit, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) { res.json({ ok: true }); return; }

  const [user] = await db
    .select({ id: users.id, firstName: users.firstName, preferredLocale: users.preferredLocale })
    .from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);

  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHashed = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.insert(passwordResets).values({ userId: user.id, tokenHash: tokenHashed, expiresAt });

    const baseUrl = process.env.APP_PUBLIC_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "localhost"}`;
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    sendPasswordResetEmail(parsed.data.email.toLowerCase(), {
      firstName: user.firstName ?? "there",
      resetLink,
      expiresIn: "1 hour",
      locale: user.preferredLocale ?? undefined,
    }).catch((err) => logger.error({ err, userId: user.id }, "Failed to enqueue reset email"));

    logger.info({ userId: user.id }, "Password reset requested");
  }

  res.json({ ok: true });
});

router.post("/auth/reset-password", authPasswordResetLimit, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Token and new password are required" }); return; }

  const tokenHashed = hashToken(parsed.data.token);
  const [entry] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHashed), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .limit(1);

  if (!entry) { res.status(400).json({ error: "Invalid or expired reset token" }); return; }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, entry.userId));
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, entry.id));
  });

  logger.info({ userId: entry.userId }, "Password reset completed");
  res.json({ ok: true });
});

export default router;
