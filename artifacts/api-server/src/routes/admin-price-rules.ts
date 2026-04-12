/**
 * admin-price-rules.ts — Admin CRUD for price_rules (Phase 2)
 *
 * All routes require admin authentication.
 *
 * GET    /admin/price-rules          — paginated list
 * GET    /admin/price-rules/:id      — single rule
 * POST   /admin/price-rules          — create
 * PUT    /admin/price-rules/:id      — full update
 * PATCH  /admin/price-rules/:id/toggle — flip isActive
 * DELETE /admin/price-rules/:id      — delete
 *
 * POST   /admin/price-rules/simulate — preview effectivePrice for a variant
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { priceRules, priceChangeLog } from "@workspace/db/schema";
import { eq, desc, and, asc, count, ilike, or } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { paramString } from "../lib/route-params";
import { insertPriceRuleSchema, updatePriceRuleSchema } from "@workspace/db/schema";
import { resolvePrice } from "../services/resolve-price";
import { logger } from "../lib/logger";

const router = Router();

// ── List ──────────────────────────────────────────────────────────────────────

router.get("/admin/price-rules", requireAuth, requireAdmin, async (req, res) => {
  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const where = search
    ? ilike(priceRules.name, `%${search}%`)
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(priceRules)
    .where(where);

  const rows = await db
    .select()
    .from(priceRules)
    .where(where)
    .orderBy(asc(priceRules.priority), asc(priceRules.id))
    .limit(limit)
    .offset(offset);

  res.json({ rules: rows, total, page, limit });
});

// ── Single ────────────────────────────────────────────────────────────────────

router.get("/admin/price-rules/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [rule] = await db.select().from(priceRules).where(eq(priceRules.id, id)).limit(1);
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }

  res.json({ rule });
});

// ── Create ────────────────────────────────────────────────────────────────────

router.post("/admin/price-rules", requireAuth, requireAdmin, async (req, res) => {
  const parsed = insertPriceRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const adminId = (req as any).user?.id ?? null;
  const [created] = await db
    .insert(priceRules)
    .values({ ...parsed.data, createdBy: adminId })
    .returning();

  logger.info({ ruleId: created?.id, adminId }, "admin: price rule created");
  res.status(201).json({ rule: created });
});

// ── Update ────────────────────────────────────────────────────────────────────

router.put("/admin/price-rules/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = updatePriceRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const [updated] = await db
    .update(priceRules)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(priceRules.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Rule not found" }); return; }

  logger.info({ ruleId: id }, "admin: price rule updated");
  res.json({ rule: updated });
});

// ── Toggle isActive ───────────────────────────────────────────────────────────

router.patch("/admin/price-rules/:id/toggle", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [current] = await db.select({ isActive: priceRules.isActive })
    .from(priceRules).where(eq(priceRules.id, id)).limit(1);
  if (!current) { res.status(404).json({ error: "Rule not found" }); return; }

  const [updated] = await db
    .update(priceRules)
    .set({ isActive: !current.isActive, updatedAt: new Date() })
    .where(eq(priceRules.id, id))
    .returning();

  res.json({ rule: updated });
});

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/admin/price-rules/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(priceRules)
    .where(eq(priceRules.id, id))
    .returning({ id: priceRules.id });

  if (!deleted) { res.status(404).json({ error: "Rule not found" }); return; }

  logger.info({ ruleId: id }, "admin: price rule deleted");
  res.json({ success: true });
});

// ── Simulator ─────────────────────────────────────────────────────────────────
// Preview what price a variant would get *right now* through the full engine.
// Does NOT require PRICING_ENGINE_V2=true — it forces the engine path.

router.post("/admin/price-rules/simulate", requireAuth, requireAdmin, async (req, res) => {
  const { variantId, qty } = req.body as { variantId?: unknown; qty?: unknown };
  const id = Number(variantId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "variantId must be a positive integer" });
    return;
  }
  const quantity = Math.max(1, Number(qty) || 1);

  // Temporarily force the engine flag on just for this call
  const prev = process.env["PRICING_ENGINE_V2"];
  process.env["PRICING_ENGINE_V2"] = "true";

  try {
    const resolved = await resolvePrice(id, quantity);
    res.json({ simulation: resolved });
  } catch (err) {
    logger.warn({ err, variantId: id }, "admin: price simulate failed");
    res.status(404).json({ error: "Variant not found" });
  } finally {
    if (prev === undefined) {
      delete process.env["PRICING_ENGINE_V2"];
    } else {
      process.env["PRICING_ENGINE_V2"] = prev;
    }
  }
});

// ── Price change log (read-only) ───────────────────────────────────────────────

router.get("/admin/price-rules/log/:variantId", requireAuth, requireAdmin, async (req, res) => {
  const variantId = parseInt(paramString(req.params, "variantId"));
  if (isNaN(variantId)) { res.status(400).json({ error: "Invalid variantId" }); return; }

  const page  = Math.max(1, Number(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: count() })
    .from(priceChangeLog)
    .where(eq(priceChangeLog.variantId, variantId));

  const rows = await db
    .select()
    .from(priceChangeLog)
    .where(eq(priceChangeLog.variantId, variantId))
    .orderBy(desc(priceChangeLog.changedAt))
    .limit(limit)
    .offset(offset);

  res.json({ log: rows, total, page, limit });
});

export default router;
