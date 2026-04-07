import { Router } from "express";
import { db } from "@workspace/db";
import { currencyRates } from "@workspace/db/schema";
import { logger } from "../lib/logger";

const router = Router();

router.get("/currencies", async (_req, res) => {
  try {
    const rows = await db.select().from(currencyRates);
    const rates: Record<string, number> = {};
    for (const r of rows) {
      const storedRate = parseFloat(r.rateToUsd);
      rates[r.currencyCode] = storedRate;
    }
    res.json({ base: "USD", rates });
  } catch (err) {
    logger.error({ err }, "Failed to fetch currency rates");
    res.status(500).json({ error: "Failed to fetch currency rates" });
  }
});

export default router;
