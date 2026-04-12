import { Router } from "express";
import { db } from "@workspace/db";
import { newsletterSubscribers, newsletterSettings } from "@workspace/db/schema";
import { eq, count, ilike, or, desc, inArray, type SQL, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { paramString } from "../lib/route-params";

const router = Router();
const guard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/newsletter/stats", ...guard, async (_req, res) => {
  const [pendingRow] = await db.select({ c: count() }).from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "PENDING"));
  const [confirmedRow] = await db.select({ c: count() }).from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "CONFIRMED"));
  const [unsubRow] = await db.select({ c: count() }).from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "UNSUBSCRIBED"));
  const [totalRow] = await db.select({ c: count() }).from(newsletterSubscribers);

  res.json({
    pending: pendingRow?.c ?? 0,
    confirmed: confirmedRow?.c ?? 0,
    unsubscribed: unsubRow?.c ?? 0,
    total: totalRow?.c ?? 0,
  });
});

router.get("/admin/newsletter/subscribers", ...guard, async (req, res) => {
  const { status, search, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const validStatuses = ["PENDING", "CONFIRMED", "UNSUBSCRIBED"] as const;
  const conditions: SQL[] = [];
  if (status && status !== "ALL") {
    if (!validStatuses.includes(status as typeof validStatuses[number])) {
      res.status(400).json({ error: "Invalid status filter" }); return;
    }
    conditions.push(eq(newsletterSubscribers.status, status as typeof validStatuses[number]));
  }
  if (search) {
    conditions.push(ilike(newsletterSubscribers.email, `%${search}%`));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(newsletterSubscribers)
    .where(where)
    .orderBy(desc(newsletterSubscribers.createdAt))
    .limit(limit).offset(offset);

  const totalQuery = db.select({ c: count() }).from(newsletterSubscribers);
  const [totalRow] = where ? await totalQuery.where(where) : await totalQuery;

  res.json({ subscribers: rows, total: totalRow?.c ?? 0, page, limit });
});

router.delete("/admin/newsletter/subscribers/:id", ...guard, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [deleted] = await db.delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id)).returning({ id: newsletterSubscribers.id });
  if (!deleted) { res.status(404).json({ error: "Subscriber not found" }); return; }
  res.json({ success: true });
});

router.post("/admin/newsletter/bulk-delete", ...guard, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) { res.status(400).json({ error: "Invalid request" }); return; }
  const numIds = ids.filter((id): id is number => typeof id === "number" && id > 0);
  if (numIds.length === 0) { res.status(400).json({ error: "No valid IDs" }); return; }
  await db.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.id, numIds));
  res.json({ success: true, count: numIds.length });
});

router.get("/admin/newsletter/export", ...guard, async (_req, res) => {
  const rows = await db.select().from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "CONFIRMED"))
    .orderBy(desc(newsletterSubscribers.createdAt));

  const csvHeader = "email,source,confirmed_at,created_at\n";
  const csvRows = rows.map((r) =>
    `${r.email},${r.source},${r.confirmedAt?.toISOString() ?? ""},${r.createdAt.toISOString()}`
  ).join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=newsletter-subscribers.csv");
  res.send(csvHeader + csvRows);
});

router.post("/admin/newsletter/import", ...guard, async (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails)) { res.status(400).json({ error: "Expected emails array" }); return; }

  let imported = 0;
  for (const email of emails) {
    if (typeof email !== "string" || !email.includes("@")) continue;
    const normalized = email.toLowerCase().trim();
    const [existing] = await db.select({ id: newsletterSubscribers.id })
      .from(newsletterSubscribers).where(eq(newsletterSubscribers.email, normalized));
    if (existing) continue;

    await db.insert(newsletterSubscribers).values({
      email: normalized,
      status: "CONFIRMED",
      source: "import",
      confirmToken: null,
      unsubToken: null,
      confirmedAt: new Date(),
    });
    imported++;
  }

  res.json({ success: true, imported });
});

const settingsGuard = [requireAuth, requireAdmin, requirePermission("manageSettings")];

router.get("/admin/newsletter/settings", ...settingsGuard, async (_req, res) => {
  let [settings] = await db.select().from(newsletterSettings);
  if (!settings) {
    [settings] = await db.insert(newsletterSettings).values({}).returning();
  }
  res.json({ settings });
});

router.put("/admin/newsletter/settings", ...settingsGuard, async (req, res) => {
  const { enabled, doubleOptIn, exitIntentEnabled, exitIntentDiscount,
    exitIntentHeadline, exitIntentBody, mailchimpApiKey, mailchimpListId } = req.body;

  const [existing] = await db.select().from(newsletterSettings);
  const values = {
    enabled: !!enabled,
    doubleOptIn: doubleOptIn !== false,
    exitIntentEnabled: !!exitIntentEnabled,
    exitIntentDiscount: parseInt(exitIntentDiscount) || 10,
    exitIntentHeadline: exitIntentHeadline || "Wait! Get 10% off your first order",
    exitIntentBody: exitIntentBody || "Subscribe to our newsletter.",
    mailchimpApiKey: mailchimpApiKey || null,
    mailchimpListId: mailchimpListId || null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(newsletterSettings).set(values).where(eq(newsletterSettings.id, existing.id));
  } else {
    await db.insert(newsletterSettings).values(values);
  }
  res.json({ success: true });
});

export default router;
