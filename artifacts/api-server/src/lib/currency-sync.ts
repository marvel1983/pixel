/**
 * Automatic exchange-rate sync.
 *
 * Rates are stored relative to EUR (the base currency).
 * i.e. rateToUsd column = "how many of this currency per 1 EUR".
 *   EUR → 1.0, USD → ~1.09, GBP → ~0.86
 *
 * Uses the free Open Exchange Rates API (no key required):
 *   https://open.er-api.com/v6/latest/EUR
 *
 * If OPEN_EXCHANGE_RATES_KEY is set in env, uses openexchangerates.org
 * for hourly updates (free tier = 1 000 req/mo).
 *
 * Falls back to hardcoded safe values so the store is never left empty.
 */

import { db } from "@workspace/db";
import { currencyRates } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// Fallback rates relative to EUR (1 EUR = X currency)
const FALLBACK_RATES: Record<string, number> = {
  EUR: 1.0,
  USD: 1.09,
  GBP: 0.86,
  PLN: 4.37,
  CZK: 25.3,
  HUF: 395,
  CAD: 1.47,
  AUD: 1.65,
  BRL: 5.48,
  TRY: 35.2,
};

async function fetchLiveRates(): Promise<Record<string, number> | null> {
  const key = process.env.OPEN_EXCHANGE_RATES_KEY;

  try {
    let url: string;
    let parseRates: (body: unknown) => Record<string, number> | null;

    if (key) {
      // openexchangerates.org – free tier, needs API key; base=EUR
      url = `https://openexchangerates.org/api/latest.json?app_id=${key}&base=EUR`;
      parseRates = (body: unknown) => {
        const b = body as { rates?: Record<string, number> };
        return b?.rates ?? null;
      };
    } else {
      // open.er-api.com – truly free, no key, updated every 24 h; base=EUR
      url = "https://open.er-api.com/v6/latest/EUR";
      parseRates = (body: unknown) => {
        const b = body as { result?: string; rates?: Record<string, number> };
        if (b?.result !== "success") return null;
        return b?.rates ?? null;
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ status: res.status, url }, "Currency API non-OK response");
      return null;
    }

    const body = await res.json() as unknown;
    return parseRates(body);
  } catch (err) {
    logger.warn({ err }, "Failed to fetch live currency rates");
    return null;
  }
}

/**
 * Pull latest rates from the external API and upsert into currency_rates table.
 * Only updates currencies that already exist in the table (never inserts new ones).
 * Falls back to FALLBACK_RATES if the external API is unavailable.
 */
export async function syncCurrencyRates(): Promise<{ updated: number; source: string }> {
  const liveRates = await fetchLiveRates();
  const rates = liveRates ?? FALLBACK_RATES;
  const source = liveRates ? "live" : "fallback";

  // Only update currencies already present in our DB
  const existing = await db.select({ currencyCode: currencyRates.currencyCode }).from(currencyRates);
  const knownCodes = new Set(existing.map((r) => r.currencyCode));

  let updated = 0;
  for (const [code, rate] of Object.entries(rates)) {
    if (!knownCodes.has(code)) continue;
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) continue;

    await db
      .update(currencyRates)
      .set({ rateToUsd: String(rate), updatedAt: new Date() })
      .where(eq(currencyRates.currencyCode, code));
    updated++;
  }

  logger.info({ updated, source }, "Currency rates synced");
  return { updated, source };
}
