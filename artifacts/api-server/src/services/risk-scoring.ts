import { db } from "@workspace/db";
import { orders, orderItems, users, siteSettings, DEFAULT_RISK_CONFIG, type RiskScoringConfig } from "@workspace/db/schema";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

export interface RiskInput {
  userId?: number;
  guestEmail: string;
  billingCountry: string;   // ISO-3166 alpha-2 from billing form
  totalUsd: number;
  items: { variantId: number; quantity: number }[];
  clientIp: string;
}

export interface RiskResult {
  score: number;
  hold: boolean;
  reasons: string[];
}

/** Fetch the country code for an IP using ip-api.com (free, no key, offline-safe). */
async function getIpCountry(ip: string): Promise<string | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null; // skip private/loopback IPs
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json() as { countryCode?: string };
    return data.countryCode ?? null;
  } catch {
    return null; // geo lookup failed — skip the signal, don't block order
  }
}

async function getRiskConfig(): Promise<RiskScoringConfig> {
  try {
    const [s] = await db.select({ riskConfig: siteSettings.riskConfig }).from(siteSettings).limit(1);
    if (!s?.riskConfig) return DEFAULT_RISK_CONFIG;
    return { ...DEFAULT_RISK_CONFIG, ...s.riskConfig };
  } catch {
    return DEFAULT_RISK_CONFIG;
  }
}

export async function scoreOrder(input: RiskInput): Promise<RiskResult> {
  const cfg = await getRiskConfig();
  const reasons: string[] = [];
  let score = 0;

  if (!cfg.enabled) return { score: 0, hold: false, reasons: [] };

  // --- Absolute hold: order total >= minOrderHoldAmount ---
  if (cfg.minOrderHoldAmount > 0 && input.totalUsd >= cfg.minOrderHoldAmount) {
    const reasons = [`Order total €${input.totalUsd.toFixed(2)} meets minimum hold amount (€${cfg.minOrderHoldAmount})`];
    logger.warn({ totalUsd: input.totalUsd, minOrderHoldAmount: cfg.minOrderHoldAmount, email: input.guestEmail }, "Order auto-held by minimum amount rule");
    return { score: 100, hold: true, reasons };
  }

  try {
    // --- Signal 1: New account placing first or high-value order ---
    if (input.userId) {
      const [userRow] = await db.select({ createdAt: users.createdAt })
        .from(users).where(eq(users.id, input.userId)).limit(1);

      if (userRow) {
        const ageMs = Date.now() - new Date(userRow.createdAt).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        if (ageHours < 24) {
          if (input.totalUsd >= cfg.newAccountHighValueMin) {
            score += cfg.newAccountHighValueScore;
            reasons.push(`New account (<24h) with high-value order (€${input.totalUsd.toFixed(2)})`);
          } else {
            score += cfg.newAccountBaseScore;
            reasons.push(`New account (<24h), order €${input.totalUsd.toFixed(2)}`);
          }
        }

        // Check if this is their first order
        const [{ orderCount }] = await db.select({ orderCount: count() })
          .from(orders)
          .where(and(eq(orders.userId, input.userId), gte(orders.id, 0)));

        if (Number(orderCount) === 0 && ageHours < 24) {
          score += cfg.firstOrderScore;
          reasons.push("First ever order from new account");
        }
      }
    } else {
      // Guest checkout with high order value
      if (input.totalUsd >= cfg.guestHighValueMin) {
        score += cfg.guestHighValueScore;
        reasons.push(`Guest checkout with high-value order (€${input.totalUsd.toFixed(2)})`);
      }
    }

    // --- Signal 2: Large quantity of the same variant ---
    const maxQty = input.items.reduce((max, item) => Math.max(max, item.quantity), 0);
    if (maxQty >= cfg.bulkQtyHighMin) {
      score += cfg.bulkQtyHighScore;
      reasons.push(`Bulk purchase: ${maxQty} units of same product`);
    } else if (maxQty >= cfg.bulkQtyLowMin) {
      score += cfg.bulkQtyLowScore;
      reasons.push(`Multiple units: ${maxQty} units of same product`);
    }

    // --- Signal 3: IP country ≠ billing country ---
    const ipCountry = await getIpCountry(input.clientIp);
    if (ipCountry && input.billingCountry) {
      const billing = input.billingCountry.toUpperCase();
      if (ipCountry !== billing) {
        score += cfg.geoMismatchScore;
        reasons.push(`IP country (${ipCountry}) doesn't match billing country (${billing})`);
      }
    }

    // --- Signal 4: Very high order total ---
    if (input.totalUsd >= cfg.highOrderValueMin) {
      score += cfg.highOrderValueScore;
      reasons.push(`Very high order value (€${input.totalUsd.toFixed(2)})`);
    }

  } catch (err) {
    logger.error({ err }, "Risk scoring error — defaulting to pass");
    return { score: 0, hold: false, reasons: [] };
  }

  const hold = score >= cfg.holdThreshold;
  if (hold) {
    logger.warn({ score, reasons, email: input.guestEmail, ip: input.clientIp }, "Order flagged for risk hold");
  }

  return { score, hold, reasons };
}
