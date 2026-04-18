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

    // Detect stale USD-based rates: EUR should be ~1.0 in EUR-base system.
    // If EUR is ~0.92 the DB still holds old USD-based values → force re-sync.
    const eurRate = rates["EUR"];
    const isWrongBase = typeof eurRate === "number" && (eurRate < 0.95 || eurRate > 1.05);
    const isStale = isWrongBase || !oldestUpdatedAt || Date.now() - oldestUpdatedAt.getTime() > STALE_THRESHOLD_MS;

    if (isStale && !syncInProgress) {
      syncInProgress = true;
      syncCurrencyRates()
        .catch((err) => logger.error({ err }, "Background currency sync failed"))
        .finally(() => { syncInProgress = false; });
    }

    // EUR is the base — always 1.0, never needs conversion; strip it from response
    // so the frontend doesn't accidentally use a stale EUR rate instead of 1.
    delete rates["EUR"];

    res.json({ base: "EUR", rates });
  } catch (err) {
    logger.error({ err }, "Failed to fetch currency rates");
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
});

export default router;
