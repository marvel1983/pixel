import { Router } from "express";
import { db } from "@workspace/db";
import { auditLog, auditActionEnum, users } from "@workspace/db/schema";
import { eq, desc, sql, and, ilike, gte, lte, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

const VALID_ACTIONS = auditActionEnum.enumValues;
type AuditAction = (typeof VALID_ACTIONS)[number];

function isValidAction(v: string): v is AuditAction {
  return (VALID_ACTIONS as readonly string[]).includes(v);
}

router.get("/admin/audit-log", requireAuth, requireAdmin, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const conditions = [];
  if (typeof req.query.action === "string" && isValidAction(req.query.action)) conditions.push(eq(auditLog.action, req.query.action));
  if (typeof req.query.userId === "string") conditions.push(eq(auditLog.userId, Number(req.query.userId)));
  if (typeof req.query.entityType === "string") conditions.push(eq(auditLog.entityType, req.query.entityType));
  if (typeof req.query.search === "string") conditions.push(ilike(auditLog.entityType, `%${req.query.search}%`));
  if (typeof req.query.from === "string") conditions.push(gte(auditLog.createdAt, new Date(req.query.from)));
  if (typeof req.query.to === "string") conditions.push(lte(auditLog.createdAt, new Date(req.query.to)));
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
  if (typeof req.query.action === "string" && isValidAction(req.query.action)) conditions.push(eq(auditLog.action, req.query.action));
  if (typeof req.query.from === "string") conditions.push(gte(auditLog.createdAt, new Date(req.query.from)));
  if (typeof req.query.to === "string") conditions.push(lte(auditLog.createdAt, new Date(req.query.to)));
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

router.get("/admin/audit-log/users", requireAuth, requireAdmin, async (_req, res) => {
  const result = await db.selectDistinct({ userId: auditLog.userId }).from(auditLog).where(sql`${auditLog.userId} IS NOT NULL`);
  const userIds = result.map((r) => r.userId!);
  if (userIds.length === 0) { res.json([]); return; }
  const usersList = await db.select({ id: users.id, email: users.email, username: users.username }).from(users).where(inArray(users.id, userIds));
  res.json(usersList);
});

export default router;
