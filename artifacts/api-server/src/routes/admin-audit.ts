import { Router } from "express";
import { db } from "@workspace/db";
import { auditLog, users } from "@workspace/db/schema";
import { eq, desc, sql, and, ilike, gte, lte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/admin/audit-log", requireAuth, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const conditions = [];
  if (req.query.action && typeof req.query.action === "string") conditions.push(eq(auditLog.action, req.query.action as never));
  if (req.query.userId && typeof req.query.userId === "string") conditions.push(eq(auditLog.userId, Number(req.query.userId)));
  if (req.query.entityType && typeof req.query.entityType === "string") conditions.push(eq(auditLog.entityType, req.query.entityType));
  if (req.query.search && typeof req.query.search === "string") conditions.push(ilike(auditLog.entityType, `%${req.query.search}%`));
  if (req.query.from && typeof req.query.from === "string") conditions.push(gte(auditLog.createdAt, new Date(req.query.from)));
  if (req.query.to && typeof req.query.to === "string") conditions.push(lte(auditLog.createdAt, new Date(req.query.to)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where);
  const rows = await db.select({
    id: auditLog.id, userId: auditLog.userId, action: auditLog.action,
    entityType: auditLog.entityType, entityId: auditLog.entityId,
    details: auditLog.details, ipAddress: auditLog.ipAddress,
    userAgent: auditLog.userAgent, createdAt: auditLog.createdAt,
    userName: users.username, userEmail: users.email,
  }).from(auditLog).leftJoin(users, eq(auditLog.userId, users.id)).where(where).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset);

  res.json({ logs: rows, total: countResult.count, page, limit });
});

router.get("/admin/audit-log/export", requireAuth, requireAdmin, async (req, res) => {
  const conditions = [];
  if (req.query.action && typeof req.query.action === "string") conditions.push(eq(auditLog.action, req.query.action as never));
  if (req.query.from && typeof req.query.from === "string") conditions.push(gte(auditLog.createdAt, new Date(req.query.from)));
  if (req.query.to && typeof req.query.to === "string") conditions.push(lte(auditLog.createdAt, new Date(req.query.to)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType,
    entityId: auditLog.entityId, ipAddress: auditLog.ipAddress,
    createdAt: auditLog.createdAt, userName: users.username, userEmail: users.email,
  }).from(auditLog).leftJoin(users, eq(auditLog.userId, users.id)).where(where).orderBy(desc(auditLog.createdAt)).limit(10000);

  const header = "ID,Action,Entity Type,Entity ID,User,Email,IP Address,Timestamp\n";
  const csv = rows.map((r) => `${r.id},"${r.action}","${r.entityType ?? ""}",${r.entityId ?? ""},"${r.userName ?? ""}","${r.userEmail ?? ""}","${r.ipAddress ?? ""}","${r.createdAt.toISOString()}"`).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=audit-log.csv");
  res.send(header + csv);
});

router.get("/admin/audit-log/actions", requireAuth, requireAdmin, async (_req, res) => {
  const actions = await db.selectDistinct({ action: auditLog.action }).from(auditLog);
  res.json(actions.map((a) => a.action));
});

export default router;
