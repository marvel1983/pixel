import { Router } from "express";
import { db } from "@workspace/db";
import { users, adminPermissions } from "@workspace/db/schema";
import { eq, or, ilike, and, inArray, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
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

  let [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

  if (existing && (existing.role === "ADMIN" || existing.role === "SUPER_ADMIN")) {
    res.status(400).json({ error: "User is already an admin" }); return;
  }

  if (existing) {
    await db.update(users).set({ role: "ADMIN" }).where(eq(users.id, existing.id));
  } else {
    const tempPassword = "Admin" + Math.random().toString(36).slice(2, 8) + "!";
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const [created] = await db.insert(users).values({
      email: email.toLowerCase(), passwordHash,
      firstName: firstName || null, lastName: lastName || null,
      role: "ADMIN", isActive: true,
    }).returning();
    existing = created;
  }

  const permValues = {
    userId: existing.id,
    manageProducts: permissions?.manageProducts ?? true,
    manageOrders: permissions?.manageOrders ?? true,
    manageCustomers: permissions?.manageCustomers ?? false,
    manageDiscounts: permissions?.manageDiscounts ?? true,
    manageContent: permissions?.manageContent ?? false,
    manageSettings: permissions?.manageSettings ?? false,
    manageAdmins: permissions?.manageAdmins ?? false,
    viewAnalytics: permissions?.viewAnalytics ?? true,
  };

  await db.insert(adminPermissions).values(permValues)
    .onConflictDoUpdate({ target: adminPermissions.userId, set: permValues });

  res.json({ success: true, userId: existing.id });
});

router.put("/admin/admin-users/:id/permissions", requireAuth, requireAdmin, requireSuperAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { permissions } = req.body;
  if (!permissions) { res.status(400).json({ error: "Permissions required" }); return; }

  const [target] = await db.select().from(users).where(eq(users.id, id));
  if (!target || (target.role !== "ADMIN" && target.role !== "SUPER_ADMIN")) {
    res.status(404).json({ error: "Admin user not found" }); return;
  }

  const permValues = {
    userId: id,
    manageProducts: permissions.manageProducts ?? true,
    manageOrders: permissions.manageOrders ?? true,
    manageCustomers: permissions.manageCustomers ?? false,
    manageDiscounts: permissions.manageDiscounts ?? true,
    manageContent: permissions.manageContent ?? false,
    manageSettings: permissions.manageSettings ?? false,
    manageAdmins: permissions.manageAdmins ?? false,
    viewAnalytics: permissions.viewAnalytics ?? true,
  };

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

export default router;
