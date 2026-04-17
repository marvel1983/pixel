import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { adminPermissions } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

type PermKey =
  | "manageProducts"
  | "manageOrders"
  | "manageCustomers"
  | "manageDiscounts"
  | "manageContent"
  | "manageSettings"
  | "manageAdmins"
  | "viewAnalytics"
  | "manageUsers"
  | "manageLoyalty";

export function requirePermission(permission: PermKey) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (req.user.role === "SUPER_ADMIN") {
      next();
      return;
    }
    if (req.user.role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    const [perms] = await db
      .select()
      .from(adminPermissions)
      .where(eq(adminPermissions.userId, req.user.userId));

    if (!perms || !(perms as Record<string, unknown>)[permission]) {
      res.status(403).json({ error: `Permission denied: ${permission}` });
      return;
    }
    next();
  };
}
