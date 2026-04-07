import { Router } from "express";
import { db } from "@workspace/db";
import {
  affiliateProfiles,
  affiliateCommissions,
  affiliateSettings,
  users,
} from "@workspace/db/schema";
import { eq, desc, ilike, or, and, sql, count, type SQL } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { approveHeldCommissions } from "../services/affiliate-service";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageOrders")];

router.get("/admin/affiliates", ...guard, async (req, res) => {
  const { status, search, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (status && status !== "ALL") {
    conditions.push(sql`${affiliateProfiles.status} = ${String(status)}`);
  }
  if (search) {
    const s = `%${search}%`;
    conditions.push(or(
      ilike(users.email, s),
      ilike(users.firstName, s),
      ilike(affiliateProfiles.referralCode, s),
    )!);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    profile: affiliateProfiles,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
  }).from(affiliateProfiles)
    .innerJoin(users, eq(affiliateProfiles.userId, users.id))
    .where(whereClause)
    .orderBy(desc(affiliateProfiles.createdAt))
    .limit(limit).offset(offset);

  const totalQuery = db.select({ c: count() }).from(affiliateProfiles)
    .innerJoin(users, eq(affiliateProfiles.userId, users.id));
  const [totalRow] = whereClause ? await totalQuery.where(whereClause) : await totalQuery;
  res.json({ affiliates: rows, total: totalRow?.c ?? 0, page, limit });
});

router.patch("/admin/affiliates/:id/status", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, adminNote } = req.body;
  if (!["APPROVED", "REJECTED", "SUSPENDED"].includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }

  await db.update(affiliateProfiles).set({
    status: status as "APPROVED" | "REJECTED" | "SUSPENDED",
    updatedAt: new Date(),
    ...(adminNote !== undefined ? { adminNote } : {}),
    ...(status === "APPROVED" ? { approvedAt: new Date() } : {}),
  }).where(eq(affiliateProfiles.id, id));
  res.json({ success: true });
});

router.patch("/admin/affiliates/:id/rate", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  const { commissionRate } = req.body;
  const rate = parseFloat(commissionRate);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    res.status(400).json({ error: "Invalid rate" }); return;
  }
  await db.update(affiliateProfiles).set({
    commissionRate: rate.toFixed(2),
    updatedAt: new Date(),
  }).where(eq(affiliateProfiles.id, id));
  res.json({ success: true });
});

router.get("/admin/affiliates/:id/commissions", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  const commissions = await db.select().from(affiliateCommissions)
    .where(eq(affiliateCommissions.affiliateId, id))
    .orderBy(desc(affiliateCommissions.createdAt))
    .limit(100);
  res.json({ commissions });
});

router.post("/admin/affiliates/:id/mark-paid", ...guard, async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount } = req.body;
  const payAmount = parseFloat(amount);
  if (isNaN(payAmount) || payAmount <= 0) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }

  const approved = await db.select().from(affiliateCommissions)
    .where(sql`${affiliateCommissions.affiliateId} = ${id} AND ${affiliateCommissions.status} = 'APPROVED'`);
  let remaining = payAmount;
  for (const c of approved) {
    if (remaining <= 0) break;
    const amt = parseFloat(c.commissionAmount);
    if (amt <= remaining) {
      await db.update(affiliateCommissions).set({ status: "PAID", paidAt: new Date() })
        .where(eq(affiliateCommissions.id, c.id));
      remaining -= amt;
    }
  }

  const actualPaid = payAmount - remaining;
  await db.update(affiliateProfiles).set({
    totalPaid: sql`${affiliateProfiles.totalPaid} + ${actualPaid.toFixed(2)}::numeric`,
    updatedAt: new Date(),
  }).where(eq(affiliateProfiles.id, id));

  res.json({ success: true, paidAmount: actualPaid.toFixed(2) });
});

const settingsGuard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/affiliate-settings", ...settingsGuard, async (_req, res) => {
  let [settings] = await db.select().from(affiliateSettings);
  if (!settings) {
    [settings] = await db.insert(affiliateSettings).values({}).returning();
  }
  res.json({ settings });
});

router.put("/admin/affiliate-settings", ...settingsGuard, async (req, res) => {
  const { enabled, defaultCommissionRate, minimumPayout, holdPeriodDays,
    autoApprove, cookieDurationDays, programDescription, termsAndConditions } = req.body;
  const [existing] = await db.select().from(affiliateSettings);
  const values = {
    enabled: !!enabled,
    defaultCommissionRate: String(defaultCommissionRate || "5.00"),
    minimumPayout: String(minimumPayout || "25.00"),
    holdPeriodDays: parseInt(holdPeriodDays) || 14,
    autoApprove: !!autoApprove,
    cookieDurationDays: parseInt(cookieDurationDays) || 30,
    programDescription: programDescription || null,
    termsAndConditions: termsAndConditions || null,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(affiliateSettings).set(values).where(eq(affiliateSettings.id, existing.id));
  } else {
    await db.insert(affiliateSettings).values(values);
  }
  res.json({ success: true });
});

router.post("/admin/affiliates/approve-held", ...guard, async (_req, res) => {
  const count = await approveHeldCommissions();
  res.json({ approved: count });
});

export default router;
