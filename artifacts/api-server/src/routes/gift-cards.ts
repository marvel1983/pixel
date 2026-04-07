import { Router } from "express";
import { db } from "@workspace/db";
import { giftCards, giftCardRedemptions, users } from "@workspace/db/schema";
import { eq, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
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

router.post("/gift-cards/validate", async (req, res) => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Gift card code is required" }); return; }
  const [card] = await db.select().from(giftCards).where(eq(giftCards.code, code.trim().toUpperCase()));
  if (!card) { res.status(404).json({ error: "Gift card not found" }); return; }
  if (card.status !== "ACTIVE") { res.status(400).json({ error: `Gift card is ${card.status.toLowerCase()}` }); return; }
  if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
    res.status(400).json({ error: "Gift card has expired" }); return;
  }
  const balance = parseFloat(card.balanceUsd);
  if (balance <= 0) { res.status(400).json({ error: "Gift card has no remaining balance" }); return; }
  res.json({ valid: true, code: card.code, balance: card.balanceUsd });
});

router.get("/account/gift-cards", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  const email = user?.email;
  const purchased = await db.select().from(giftCards)
    .where(email
      ? or(eq(giftCards.purchasedByUserId, userId), eq(giftCards.recipientEmail, email))
      : eq(giftCards.purchasedByUserId, userId));
  res.json({ giftCards: purchased });
});

router.post("/account/gift-cards/check-balance", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Code required" }); return; }
  const [card] = await db.select({
    code: giftCards.code, balanceUsd: giftCards.balanceUsd,
    status: giftCards.status, expiresAt: giftCards.expiresAt,
  }).from(giftCards).where(eq(giftCards.code, code.trim().toUpperCase()));
  if (!card) { res.status(404).json({ error: "Gift card not found" }); return; }
  res.json({ card });
});

export default router;
