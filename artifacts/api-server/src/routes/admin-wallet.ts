import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import { walletTransactions } from "@workspace/db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { getOrCreateWallet, creditWallet, debitWallet } from "../services/wallet-service";
import { logger } from "../lib/logger";

const router = Router();
const auth = [requireAuth, requireAdmin, requirePermission("manageCustomers")];

router.get("/admin/wallet/:userId", ...auth, async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!userId || isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const wallet = await getOrCreateWallet(userId);
  const txs = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(50);

  res.json({ wallet, transactions: txs });
});

const adjustSchema = z.object({
  type: z.enum(["CREDIT", "DEBIT"]),
  amountUsd: z.number().positive().max(10000),
  reason: z.string().min(1).max(500),
});

router.post("/admin/wallet/:userId/adjust", ...auth, async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (!userId || isNaN(userId)) { res.status(400).json({ error: "Invalid user ID" }); return; }

  const parsed = adjustSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid adjustment data" }); return; }
  const { type, amountUsd, reason } = parsed.data;
  const adminId = req.user!.userId;

  try {
    if (type === "CREDIT") {
      const { wallet } = await creditWallet(userId, amountUsd, "CREDIT",
        `Admin credit: ${reason}`, `admin:${adminId}`);
      res.json({ balanceUsd: wallet.balanceUsd });
    } else {
      const { wallet } = await debitWallet(userId, amountUsd, "DEBIT",
        `Admin debit: ${reason}`, `admin:${adminId}`);
      res.json({ balanceUsd: wallet.balanceUsd });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Adjustment failed";
    res.status(400).json({ error: msg });
  }
});

export default router;
