import { Router } from "express";
import { db } from "@workspace/db";
import { currencyRates } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { syncCurrencyRates } from "../lib/currency-sync";

const router = Router();

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
let syncInProgress = false;

router.get("/currencies", async (_req, res) => {
  try {
    const rows = await db.select().from(currencyRates);
    const rates: Record<string, number> = {};
    let oldestUpdatedAt: Date | null = null;

    for (const r of rows) {
      if (!r.enabled) continue;
      const rate = parseFloat(r.rateToUsd);
      if (isFinite(rate) && rate > 0) {
        rates[r.currencyCode] = rate;
      }
      if (!oldestUpdatedAt || r.updatedAt < oldestUpdatedAt) {
        oldestUpdatedAt = r.updatedAt;
      }
    }

    // Lazy background refresh if rates are stale
    const isStale = !oldestUpdatedAt || Date.now() - oldestUpdatedAt.getTime() > STALE_THRESHOLD_MS;
    if (isStale && !syncInProgress) {
      syncInProgress = true;
      syncCurrencyRates()
        .catch((err) => logger.error({ err }, "Background currency sync failed"))
        .finally(() => { syncInProgress = false; });
    }

    res.json({ base: "USD", rates });
  } catch (err) {
    logger.error({ err }, "Failed to fetch currency rates");
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
});

export default router;
