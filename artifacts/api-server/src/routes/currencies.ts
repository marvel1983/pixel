import { Router } from "express";
import { db } from "@workspace/db";
import { currencyRates } from "@workspace/db/schema";
import { logger } from "../lib/logger";
import { syncCurrencyRates } from "../lib/currency-sync";

const router = Router();

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
let syncInProgress = false;

async function loadRatesFromDb(): Promise<{ rates: Record<string, number>; oldestUpdatedAt: Date | null }> {
  const rows = await db.select().from(currencyRates);
  const rates: Record<string, number> = {};
  let oldestUpdatedAt: Date | null = null;
  for (const r of rows) {
    if (!r.enabled) continue;
    const rate = parseFloat(r.rateToUsd);
    if (isFinite(rate) && rate > 0) rates[r.currencyCode] = rate;
    if (!oldestUpdatedAt || r.updatedAt < oldestUpdatedAt) oldestUpdatedAt = r.updatedAt;
  }
  return { rates, oldestUpdatedAt };
}

router.get("/currencies", async (_req, res) => {
  try {
    let { rates, oldestUpdatedAt } = await loadRatesFromDb();

    // EUR should be ~1.0 in EUR-base system. If it's ~0.92 the DB holds old
    // USD-based values. Sync synchronously so this response has correct rates.
    const eurRate = rates["EUR"];
    const isWrongBase = typeof eurRate === "number" && (eurRate < 0.95 || eurRate > 1.05);
    if (isWrongBase) {
      try {
        await syncCurrencyRates();
        ({ rates, oldestUpdatedAt } = await loadRatesFromDb());
      } catch (err) {
        logger.warn({ err }, "Sync during wrong-base fix failed — returning stale rates");
      }
    } else {
      // Lazy background refresh when rates are simply stale (correct base already)
      const isStale = !oldestUpdatedAt || Date.now() - oldestUpdatedAt.getTime() > STALE_THRESHOLD_MS;
      if (isStale && !syncInProgress) {
        syncInProgress = true;
        syncCurrencyRates()
          .catch((err) => logger.error({ err }, "Background currency sync failed"))
          .finally(() => { syncInProgress = false; });
      }
    }

    res.json({ base: "EUR", rates });
  } catch (err) {
    logger.error({ err }, "Failed to fetch currency rates");
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
});

export default router;
