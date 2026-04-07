import { Router } from "express";
import { db } from "@workspace/db";
import { currencyRates } from "@workspace/db/schema";
import { logger } from "../lib/logger";

const router = Router();

router.get("/currencies", async (_req, res) => {
  try {
    const rates = await db.select().from(currencyRates);
    const rateMap: Record<string, number> = {};
    for (const r of rates) {
      rateMap[r.currencyCode] = parseFloat(r.rateToUsd);
    }
    res.json({ rates: rateMap });
  } catch (err) {
    logger.error({ err }, "Failed to fetch currency rates");
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
});

export default router;
