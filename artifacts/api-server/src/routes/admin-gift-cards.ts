import { Router } from "express";
import { db } from "@workspace/db";
import { giftCards, giftCardRedemptions, orders } from "@workspace/db/schema";
import { eq, desc, ilike, or, count, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import crypto from "crypto";

const router = Router();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 4; i++) {
    if (i > 0) code += "-";
    for (let j = 0; j < 4; j++) {
      code += chars[crypto.randomInt(chars.length)];
    }
  }
  return code;
}

router.get("/admin/gift-cards", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { search, status, page: pg, limit: lm } = req.query;
  const page = Math.max(1, parseInt(pg as string) || 1);
  const limit = Math.min(100, parseInt(lm as string) || 25);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status && status !== "ALL") conditions.push(eq(giftCards.status, status as any));
  if (search) {
    conditions.push(or(
      ilike(giftCards.code, `%${search}%`),
      ilike(giftCards.recipientEmail, `%${search}%`),
    ));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db.select().from(giftCards)
    .where(where).orderBy(desc(giftCards.createdAt))
    .limit(limit).offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(giftCards).where(where);
  res.json({ giftCards: rows, total, page, limit });
});

router.post("/admin/gift-cards", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const { amount, recipientEmail, recipientName, expiresAt } = req.body;
  const parsedAmt = parseFloat(amount);
  if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
    res.status(400).json({ error: "Valid positive amount required" }); return;
  }

  const code = generateCode();
  const [card] = await db.insert(giftCards).values({
    code,
    initialAmountUsd: parsedAmt.toFixed(2),
    balanceUsd: parsedAmt.toFixed(2),
    recipientEmail: recipientEmail || null,
    recipientName: recipientName || null,
    isManual: true,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();

  res.json({ success: true, giftCard: card });
});

router.put("/admin/gift-cards/:id/deactivate", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id));
  if (!card) { res.status(404).json({ error: "Gift card not found" }); return; }

  await db.update(giftCards).set({ status: "DEACTIVATED" }).where(eq(giftCards.id, id));
  res.json({ success: true });
});

router.put("/admin/gift-cards/:id/activate", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id));
  if (!card) { res.status(404).json({ error: "Gift card not found" }); return; }

  await db.update(giftCards).set({ status: "ACTIVE" }).where(eq(giftCards.id, id));
  res.json({ success: true });
});

router.get("/admin/gift-cards/:id/redemptions", requireAuth, requireAdmin, requirePermission("manageOrders"), async (req, res) => {
  const id = parseInt(req.params.id);
  const redemptions = await db.select({
    id: giftCardRedemptions.id,
    amountUsd: giftCardRedemptions.amountUsd,
    balanceBefore: giftCardRedemptions.balanceBefore,
    balanceAfter: giftCardRedemptions.balanceAfter,
    createdAt: giftCardRedemptions.createdAt,
    orderNumber: orders.orderNumber,
  }).from(giftCardRedemptions)
    .innerJoin(orders, eq(giftCardRedemptions.orderId, orders.id))
    .where(eq(giftCardRedemptions.giftCardId, id))
    .orderBy(desc(giftCardRedemptions.createdAt));
  res.json({ redemptions });
});

export default router;
