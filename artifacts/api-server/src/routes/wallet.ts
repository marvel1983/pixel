import { Router } from "express";
import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletTransactions } from "@workspace/db/schema";
import { requireAuth } from "../middleware/auth";
import { getOrCreateWallet, creditWallet } from "../services/wallet-service";
import { logger } from "../lib/logger";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { getActivePaymentConfig } from "../lib/payment-config";
import { createStripeClient } from "../lib/stripe-client";

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
  const limitRaw = parseInt(req.query.limit as string) || 20;
  const limit = Math.min(50, Math.max(1, limitRaw));

  const [countRow] = await db
    .select({ total: count() })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId));

  const total = Number(countRow?.total ?? 0);

  const txs = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit).offset((page - 1) * limit);

  res.json({ transactions: txs, page, limit, total });
});

// Returns publishable key so the frontend can initialise Stripe Elements
router.get("/wallet/topup/config", async (_req, res) => {
  const config = await getActivePaymentConfig();
  if (!config || config.provider !== "stripe" || !config.publishableKey) {
    res.status(503).json({ error: "Wallet top-up is not available" }); return;
  }
  res.json({ publishableKey: config.publishableKey });
});

const intentSchema = z.object({ amountUsd: z.number().min(5).max(500) });

// Step 1: create a Stripe PaymentIntent — returns client_secret to the frontend
router.post("/wallet/topup/intent", requireAuth, async (req, res) => {
  const parsed = intentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Amount must be between $5 and $500" }); return; }

  const config = await getActivePaymentConfig();
  if (!config || config.provider !== "stripe") {
    res.status(503).json({ error: "Wallet top-up is not available" }); return;
  }

  try {
    const stripe = createStripeClient(config.secretKey);
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(parsed.data.amountUsd * 100),
      currency: "usd",
      metadata: {
        userId: String(req.user!.userId),
        type: "wallet_topup",
        amountUsd: parsed.data.amountUsd.toFixed(2),
      },
    });
    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (err) {
    logger.error({ err }, "Failed to create wallet topup PaymentIntent");
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Step 2: verify the PaymentIntent succeeded on Stripe's side, then credit wallet
router.post("/wallet/topup/confirm", requireAuth, requireIdempotencyKey(), async (req, res) => {
  const { paymentIntentId } = req.body;
  if (typeof paymentIntentId !== "string" || !paymentIntentId.startsWith("pi_")) {
    res.status(400).json({ error: "Invalid payment intent ID" }); return;
  }

  const userId = req.user!.userId;

  // Already credited — return current balance without double-crediting
  const [existing] = await db.select({ id: walletTransactions.id })
    .from(walletTransactions)
    .where(eq(walletTransactions.referenceId, paymentIntentId))
    .limit(1);
  if (existing) {
    const wallet = await getOrCreateWallet(userId);
    res.json({ balanceUsd: wallet.balanceUsd, alreadyCredited: true }); return;
  }

  const config = await getActivePaymentConfig();
  if (!config || config.provider !== "stripe") {
    res.status(503).json({ error: "Wallet top-up is not available" }); return;
  }

  try {
    const stripe = createStripeClient(config.secretKey);
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify this PI belongs to the authenticated user
    if (pi.metadata?.userId !== String(userId)) {
      res.status(403).json({ error: "Unauthorized" }); return;
    }
    if (pi.status !== "succeeded") {
      res.status(402).json({ error: `Payment not confirmed (status: ${pi.status})` }); return;
    }

    const amountUsd = parseFloat(pi.metadata?.amountUsd ?? "0");
    if (!amountUsd || amountUsd < 5) {
      res.status(400).json({ error: "Invalid payment amount" }); return;
    }

    const { wallet, tx } = await creditWallet(
      userId, amountUsd, "TOPUP",
      `Wallet top-up $${amountUsd.toFixed(2)}`,
      pi.id,
    );

    logger.info({ userId, amountUsd, paymentIntentId: pi.id }, "Wallet top-up credited");
    res.json({ balanceUsd: wallet.balanceUsd, transaction: tx });
  } catch (err) {
    logger.error({ err, paymentIntentId }, "Wallet top-up confirm failed");
    res.status(500).json({ error: "Failed to confirm top-up" });
  }
});

export default router;
