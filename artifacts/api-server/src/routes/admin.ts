import { Router } from "express";
import { db } from "@workspace/db";
import { users } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res) => {
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users);

  res.json({ users: allUsers });
});

export default router;
