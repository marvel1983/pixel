import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { users, adminPermissions, adminInvites } from "@workspace/db/schema";
import { eq, inArray, desc, and } from "drizzle-orm";
import { requireAuth, requireAdmin, signToken } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();

function requireSuperAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}

router.get("/admin/admin-users", requireAuth, requireAdmin, async (_req, res) => {
  const admins = await db
    .select({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, role: users.role, isActive: users.isActive,
      lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
    })
    .from(users)
    .where(inArray(users.role, ["ADMIN", "SUPER_ADMIN"]))
    .orderBy(desc(users.createdAt));

  const perms = await db.select().from(adminPermissions);
  const permMap = Object.fromEntries(perms.map((p) => [p.userId, p]));

  res.json(admins.map((a) => ({ ...a, permissions: permMap[a.id] || null })));
});

router.post("/admin/admin-users/invite", requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const { email, firstName, lastName, permissions } = req.body;
  if (!email) { res.status(400).json({ error: "Email is required" }); return; }

  const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

  if (existing && (existing.role === "ADMIN" || existing.role === "SUPER_ADMIN")) {
    res.status(400).json({ error: "User is already an admin" }); return;
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  if (existing) {
    await db.update(users).set({ role: "ADMIN" }).where(eq(users.id, existing.id));
    const permValues = buildPermValues(existing.id, permissions);
    await db.insert(adminPermissions).values(permValues)
      .onConflictDoUpdate({ target: adminPermissions.userId, set: permValues });
    await db.insert(adminInvites).values({
      email: email.toLowerCase(), token: inviteToken,
      invitedBy: req.user!.userId, userId: existing.id,
      permissionsJson: JSON.stringify(permissions || {}),
      accepted: true, expiresAt,
    });
    res.json({ success: true, userId: existing.id, promoted: true });
  } else {
    await db.insert(adminInvites).values({
      email: email.toLowerCase(), token: inviteToken,
      invitedBy: req.user!.userId, expiresAt,
      permissionsJson: JSON.stringify(permissions || {}),
    });
    res.json({ success: true, inviteToken, inviteUrl: `/admin/accept-invite?token=${inviteToken}` });
  }
});

router.get("/admin/accept-invite/validate", async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(400).json({ error: "Token required" }); return; }
  const [invite] = await db.select().from(adminInvites)
    .where(and(eq(adminInvites.token, token), eq(adminInvites.accepted, false)));
  if (!invite) { res.status(404).json({ error: "Invalid or expired invite" }); return; }
  if (invite.expiresAt < new Date()) { res.status(410).json({ error: "Invite has expired" }); return; }
  res.json({ email: invite.email });
});

router.post("/admin/accept-invite", async (req, res) => {
  const { token, password, firstName, lastName } = req.body;
  if (!token || !password) { res.status(400).json({ error: "Token and password required" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }

  const [invite] = await db.select().from(adminInvites)
    .where(and(eq(adminInvites.token, token), eq(adminInvites.accepted, false)));
  if (!invite) { res.status(404).json({ error: "Invalid or expired invite" }); return; }
  if (invite.expiresAt < new Date()) { res.status(410).json({ error: "Invite has expired" }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({
    email: invite.email, passwordHash,
    firstName: firstName || null, lastName: lastName || null,
    role: "ADMIN", isActive: true,
  }).returning();

  const savedPerms = invite.permissionsJson ? JSON.parse(invite.permissionsJson) : {};
  const permValues = buildPermValues(user.id, savedPerms);
  await db.insert(adminPermissions).values(permValues)
    .onConflictDoUpdate({ target: adminPermissions.userId, set: permValues });

  await db.update(adminInvites).set({ accepted: true, userId: user.id })
    .where(eq(adminInvites.id, invite.id));

  const jwt = signToken({ userId: user.id, email: user.email, role: "ADMIN" });
  res.json({ success: true, token: jwt, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatarUrl: null } });
});

router.put("/admin/admin-users/:id/permissions", requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { permissions } = req.body;
  if (!permissions) { res.status(400).json({ error: "Permissions required" }); return; }
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target || (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN")) {
    res.status(404).json({ error: "Admin user not found" }); return;
  }
  const permValues = buildPermValues(id, permissions);
  await db.insert(adminPermissions).values(permValues)
    .onConflictDoUpdate({ target: adminPermissions.userId, set: permValues });
  res.json({ success: true });
});

router.delete("/admin/admin-users/:id", requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user!.userId) {
    res.status(400).json({ error: "Cannot revoke your own admin access" }); return;
  }
  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target || (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN")) {
    res.status(404).json({ error: "Admin user not found" }); return;
  }
  if (target.role === "SUPER_ADMIN") {
    res.status(403).json({ error: "Cannot revoke super admin access" }); return;
  }
  await db.delete(adminPermissions).where(eq(adminPermissions.userId, id));
  await db.update(users).set({ role: "CUSTOMER" }).where(eq(users.id, id));
  res.json({ success: true });
});

function buildPermValues(userId: number, p: any) {
  return {
    userId,
    manageProducts: p?.manageProducts ?? true,
    manageOrders: p?.manageOrders ?? true,
    manageCustomers: p?.manageCustomers ?? false,
    manageDiscounts: p?.manageDiscounts ?? true,
    manageContent: p?.manageContent ?? false,
    manageSettings: p?.manageSettings ?? false,
    manageAdmins: p?.manageAdmins ?? false,
    viewAnalytics: p?.viewAnalytics ?? true,
  };
}

export default router;
