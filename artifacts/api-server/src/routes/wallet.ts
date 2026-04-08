import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletTransactions } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { getOrCreateWallet, creditWallet } from "../services/wallet-service";
import { processPayment } from "../services/payment";
import { logger } from "../lib/logger";
import { requireIdempotencyKey } from "../middleware/idempotency";

const router = Router();

router.get("/wallet/balance", requireAuth, async (req, res) => {
  const wallet = await getOrCreateWallet(req.user!.userId);
  res.json({
    balanceUsd: wallet.balanceUsd,
    totalDeposited: wallet.totalDeposited,
    totalSpent: wallet.totalSpent,
  });
});

router.get("/wallet/transactions", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 20;

  const txs = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit).offset((page - 1) * limit);

  res.json({ transactions: txs, page, limit });
});

const topUpSchema = z.object({
  amountUsd: z.number().min(5).max(500),
  cardToken: z.string().min(1),
});

router.post("/wallet/topup", requireAuth, requireIdempotencyKey(), async (req, res) => {
  const parsed = topUpSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid top-up data" }); return; }
  const { amountUsd, cardToken } = parsed.data;
  const userId = req.user!.userId;

  try {
    const payResult = await processPayment({
      amount: amountUsd.toFixed(2),
      currency: "USD",
      cardToken,
      email: req.user!.email ?? "customer@store.com",
    });
    if (!payResult.success) {
      res.status(402).json({ error: payResult.error ?? "Payment declined" }); return;
    }

    const { wallet, tx } = await creditWallet(
      userId, amountUsd, "TOPUP",
      `Wallet top-up $${amountUsd.toFixed(2)}`,
      payResult.paymentIntentId,
    );

    res.json({ balanceUsd: wallet.balanceUsd, transaction: tx });
  } catch (err) {
    logger.error(err, "Wallet top-up failed");
    res.status(500).json({ error: "Top-up failed" });
  }
});

export default router;
