import { eq, and, sql, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import { giftCards, giftCardRedemptions } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { sendEmail } from "../lib/email/mailer";

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

  try {
    await sendGiftCardEmail(card, recipientName, senderName, personalMessage);
    await db.update(giftCards).set({ emailSent: true }).where(eq(giftCards.id, card.id));
  } catch (err) {
    logger.error({ err, code }, "Failed to send gift card email (non-fatal)");
  }
  return card;
}

async function sendGiftCardEmail(
  card: typeof giftCards.$inferSelect,
  recipientName: string, senderName: string, personalMessage: string,
) {
  if (!card.recipientEmail) return;
  const name = recipientName || "there";
  const from = senderName || "Someone";
  const msgHtml = personalMessage ? `<p style="margin:16px 0;padding:12px 16px;background:#f0f4ff;border-radius:8px;font-style:italic;">"${personalMessage}"</p>` : "";

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:28px;">You've received a gift card!</h1>
    <p style="color:#dbeafe;margin:8px 0 0;font-size:16px;">From PixelCodes Store</p>
  </div>
  <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:16px;color:#374151;">Hi ${name},</p>
    <p style="font-size:16px;color:#374151;">${from} sent you a PixelCodes gift card!</p>
    ${msgHtml}
    <div style="text-align:center;margin:24px 0;padding:24px;background:#f8fafc;border-radius:12px;border:2px dashed #3b82f6;">
      <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Your Gift Card Code</p>
      <p style="margin:0;font-size:24px;font-weight:bold;letter-spacing:2px;color:#1e40af;font-family:monospace;">${card.code}</p>
      <p style="margin:12px 0 0;font-size:20px;font-weight:bold;color:#059669;">$${card.initialAmountUsd}</p>
    </div>
    <p style="font-size:14px;color:#6b7280;text-align:center;">Redeem at checkout on any product in our store.</p>
  </div>
</div>`;

  await sendEmail(card.recipientEmail, `You've received a $${card.initialAmountUsd} PixelCodes Gift Card!`, html);
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
