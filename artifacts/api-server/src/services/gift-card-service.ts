import { eq, and, sql, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { giftCards, giftCardRedemptions } from "@workspace/db/schema";
import { logger } from "../lib/logger";

interface GiftCardApply {
  code: string;
  amount: number;
}

export async function validateGiftCards(cards: GiftCardApply[]): Promise<{ valid: boolean; error?: string }> {
  for (const gc of cards) {
    const [card] = await db.select().from(giftCards)
      .where(and(eq(giftCards.code, gc.code.trim().toUpperCase()), eq(giftCards.status, "ACTIVE")));
    if (!card) return { valid: false, error: `Gift card ${gc.code} is invalid or inactive` };
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) {
      return { valid: false, error: `Gift card ${gc.code} has expired` };
    }
    const balance = parseFloat(card.balanceUsd);
    if (gc.amount > balance + 0.01) {
      return { valid: false, error: `Gift card ${gc.code} has insufficient balance ($${balance.toFixed(2)})` };
    }
  }
  return { valid: true };
}

export async function redeemGiftCards(orderId: number, cards: GiftCardApply[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const gc of cards) {
      const code = gc.code.trim().toUpperCase();
      const [card] = await tx.select().from(giftCards)
        .where(and(eq(giftCards.code, code), eq(giftCards.status, "ACTIVE")));
      if (!card) throw new Error(`Gift card ${code} is no longer valid`);

      const balanceBefore = parseFloat(card.balanceUsd);
      const deductAmount = Math.min(gc.amount, balanceBefore);
      if (deductAmount <= 0) throw new Error(`Gift card ${code} has no balance`);
      const balanceAfter = Math.max(0, balanceBefore - deductAmount);

      const updated = await tx.update(giftCards).set({
        balanceUsd: balanceAfter.toFixed(2),
        status: balanceAfter <= 0 ? "REDEEMED" : "ACTIVE",
      }).where(and(
        eq(giftCards.id, card.id),
        gte(giftCards.balanceUsd, deductAmount.toFixed(2)),
      )).returning({ id: giftCards.id });

      if (!updated.length) throw new Error(`Gift card ${code} has insufficient balance (concurrent use)`);

      await tx.insert(giftCardRedemptions).values({
        giftCardId: card.id, orderId,
        amountUsd: deductAmount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
      });
      logger.info({ code, orderId, deducted: deductAmount, remaining: balanceAfter }, "Gift card redeemed");
    }
  });
}

export async function createGiftCardForOrder(
  orderId: number,
  userId: number | null,
  amount: string,
  recipientEmail: string,
  recipientName: string,
  senderName: string,
  personalMessage: string,
): Promise<typeof giftCards.$inferSelect> {
  const code = generateGiftCardCode();
  const [card] = await db.insert(giftCards).values({
    code,
    initialAmountUsd: amount,
    balanceUsd: amount,
    purchasedByUserId: userId,
    purchaseOrderId: orderId,
    recipientEmail,
    recipientName: recipientName || null,
    senderName: senderName || null,
    personalMessage: personalMessage || null,
  }).returning();
  logger.info({ code, orderId, amount, recipientEmail }, "Gift card created for order");
  return card;
}

function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 4; i++) {
    if (i > 0) code += "-";
    for (let j = 0; j < 4; j++) {
      const crypto = require("crypto");
      code += chars[crypto.randomInt(chars.length)];
    }
  }
  return code;
}
