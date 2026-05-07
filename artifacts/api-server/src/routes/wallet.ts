import { Router } from "express";
import { z } from "zod";
import { eq, desc, count } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletTransactions, siteSettings } from "@workspace/db/schema";
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

const amountSchema = z.object({ amountUsd: z.number().min(5).max(500) });

// Creates a Stripe Checkout Session and returns the hosted page URL
router.post("/wallet/topup/session", requireAuth, async (req, res) => {
  const parsed = amountSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Amount must be between $5 and $500" }); return; }

  const config = await getActivePaymentConfig();
  if (!config || config.provider !== "stripe") {
    res.status(503).json({ error: "Wallet top-up is not available" }); return;
  }

  try {
    const stripe = createStripeClient(config.secretKey);
    const [settings] = await db.select({ defaultCurrency: siteSettings.defaultCurrency }).from(siteSettings);
    const currency = (settings?.defaultCurrency ?? "EUR").toLowerCase();
    const storeUrl = process.env.STORE_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? "http://localhost:18539";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: "Wallet Top-Up" },
          unit_amount: Math.round(parsed.data.amountUsd * 100),
        },
        quantity: 1,
      }],
      metadata: {
        userId: String(req.user!.userId),
        type: "wallet_topup",
        amountUsd: parsed.data.amountUsd.toFixed(2),
      },
      success_url: `${storeUrl}/account/balance?topup_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${storeUrl}/account/balance`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Failed to create wallet topup checkout session");
    res.status(500).json({ error: "Failed to initiate payment" });
  }
});

// Called on return from Stripe — verifies payment and credits wallet
router.post("/wallet/topup/confirm-session", requireAuth, requireIdempotencyKey(), async (req, res) => {
  const { sessionId } = req.body;
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    res.status(400).json({ error: "Invalid session ID" }); return;
  }

  const userId = req.user!.userId;

  const [existing] = await db.select({ id: walletTransactions.id })
    .from(walletTransactions)
    .where(eq(walletTransactions.referenceId, sessionId))
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
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== String(userId)) {
      res.status(403).json({ error: "Unauthorized" }); return;
    }
    if (session.payment_status !== "paid") {
      res.status(402).json({ error: `Payment not confirmed (status: ${session.payment_status})` }); return;
    }

    const amountUsd = parseFloat(session.metadata?.amountUsd ?? "0");
    if (!amountUsd || amountUsd < 5) {
      res.status(400).json({ error: "Invalid payment amount" }); return;
    }

    const { wallet } = await creditWallet(
      userId, amountUsd, "TOPUP",
      `Wallet top-up $${amountUsd.toFixed(2)}`,
      sessionId,
    );

    logger.info({ userId, amountUsd, sessionId }, "Wallet top-up credited");
    res.json({ balanceUsd: wallet.balanceUsd });
  } catch (err) {
    logger.error({ err, sessionId }, "Wallet top-up confirm-session failed");
    res.status(500).json({ error: "Failed to confirm top-up" });
  }
});

export default router;
