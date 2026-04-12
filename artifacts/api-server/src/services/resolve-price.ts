/**
 * resolve-price.ts — Canonical pricing engine (Phase 2)
 *
 * Gate: PRICING_ENGINE_V2=true must be set to activate.
 * With the flag off, resolvePriceBatch() falls back to the legacy inline
 * logic so this file can be deployed without changing live behaviour.
 *
 * Priority chain (first match wins):
 *   1. Flash Sale  — salePriceUsd, qty-guarded
 *   2. priceOverrideUsd — admin hard override on the variant
 *   3. price_rules — highest-priority matching rule (PERCENTAGE_OFF / FIXED_PRICE)
 *   4. Bulk tier   — discountPercent × effectivePrice
 *   5. Base price  — productVariants.priceUsd
 *
 * Bundle items are NOT routed through this engine.
 * Coupons / loyalty / wallet / gift cards are NOT part of this engine;
 * they remain as order-level adjustments in orders.ts.
 */

import { eq, and, or, isNull, lte, gte, asc } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants, products, priceRules } from "@workspace/db/schema";
import { getFlashSaleInfo } from "./flash-sale-pricing";
import { getBulkDiscount } from "./bulk-pricing-service";
import { logger } from "../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppliedStackEntry {
  type: "BASE" | "PRICE_OVERRIDE" | "PRICE_RULE" | "FLASH_SALE" | "BULK";
  id:    number | null;
  label: string;
  /** How much this layer saved vs. base price (always >= 0) */
  savedUsd: string;
}

export interface ResolvedPrice {
  variantId:            number;
  productId:            number;
  basePriceUsd:         string;   // productVariants.priceUsd — never changes
  compareAtPriceUsd:    string | null;
  effectiveUnitPriceUsd: string;  // what the customer pays per unit
  appliedStack:         AppliedStackEntry[];
  isFlashSale:          boolean;
  flashSaleId:          number | null;
}

// ── Feature flag ──────────────────────────────────────────────────────────────

function engineEnabled(): boolean {
  return process.env["PRICING_ENGINE_V2"] === "true";
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Round to 2 decimal places, returns string */
function r2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Fetch active price_rules that cover the given variantId/categoryId. */
async function fetchMatchingRules(
  variantId: number,
  categoryId: number | null | undefined,
): Promise<typeof priceRules.$inferSelect[]> {
  const now = new Date();

  const rows = await db
    .select()
    .from(priceRules)
    .where(
      and(
        eq(priceRules.isActive, true),
        or(isNull(priceRules.validFrom), lte(priceRules.validFrom, now)),
        or(isNull(priceRules.validTo),   gte(priceRules.validTo,   now)),
      ),
    )
    .orderBy(asc(priceRules.priority), asc(priceRules.id));

  return rows.filter((rule) => {
    const vIds = rule.scopeVariantIds as number[] | null;
    const cIds = rule.scopeCategoryIds as number[] | null;

    const hasVariantScope   = Array.isArray(vIds) && vIds.length > 0;
    const hasCategoryScope  = Array.isArray(cIds) && cIds.length > 0;

    // Store-wide rule (no scope set)
    if (!hasVariantScope && !hasCategoryScope) return true;

    // Variant-specific match
    if (hasVariantScope && vIds!.includes(variantId)) return true;

    // Category match
    if (hasCategoryScope && categoryId && cIds!.includes(categoryId)) return true;

    return false;
  });
}

/** Apply a single rule to a candidate price. Returns new price or null if rule doesn't change it. */
function applyRule(
  rule: typeof priceRules.$inferSelect,
  candidatePrice: number,
): number {
  const val = parseFloat(rule.value);
  if (rule.ruleType === "PERCENTAGE_OFF") {
    const pct = Math.min(Math.max(val, 0), 100);
    return candidatePrice * (1 - pct / 100);
  }
  if (rule.ruleType === "FIXED_PRICE") {
    return Math.max(0, val);
  }
  return candidatePrice;
}

// ── Core resolution (single variant) ─────────────────────────────────────────

async function resolveOne(
  variantId: number,
  quantity: number,
  flashMap: Map<number, Awaited<ReturnType<typeof getFlashSaleInfo>> extends Map<number, infer V> ? V : never>,
  variant: {
    id: number;
    productId: number;
    priceUsd: string;
    priceOverrideUsd: string | null;
    compareAtPriceUsd: string | null;
    categoryId: number | null | undefined;
  },
): Promise<ResolvedPrice> {
  const basePrice  = parseFloat(variant.priceUsd);
  const stack: AppliedStackEntry[] = [];

  let effective = basePrice;
  let isFlashSale = false;
  let flashSaleId: number | null = null;

  // ── Step 1: Flash Sale ─────────────────────────────────────────────────────
  const flashInfo = flashMap.get(variantId);
  if (flashInfo) {
    effective   = parseFloat(flashInfo.salePriceUsd);
    isFlashSale = true;
    flashSaleId = flashInfo.flashSaleId;
    stack.push({
      type:     "FLASH_SALE",
      id:       flashInfo.flashSaleId,
      label:    `Flash Sale`,
      savedUsd: r2(Math.max(0, basePrice - effective)),
    });
    // Flash sale wins — skip override and rules
    const bulkPct = await getBulkDiscount(variant.productId, quantity);
    if (bulkPct > 0) {
      const before = effective;
      effective *= (1 - bulkPct / 100);
      stack.push({
        type:     "BULK",
        id:       null,
        label:    `${bulkPct}% bulk discount (qty ${quantity})`,
        savedUsd: r2(Math.max(0, before - effective)),
      });
    }
    return build(variantId, variant, basePrice, effective, stack, isFlashSale, flashSaleId);
  }

  // ── Step 2: priceOverrideUsd ───────────────────────────────────────────────
  if (variant.priceOverrideUsd) {
    const override = parseFloat(variant.priceOverrideUsd);
    if (!isNaN(override) && override >= 0) {
      effective = override;
      stack.push({
        type:     "PRICE_OVERRIDE",
        id:       null,
        label:    "Admin price override",
        savedUsd: r2(Math.max(0, basePrice - effective)),
      });
    }
  }

  // ── Step 3: price_rules ────────────────────────────────────────────────────
  const rules = await fetchMatchingRules(variantId, variant.categoryId);
  if (rules.length > 0) {
    // Single winner — highest priority (lowest number, first in sorted list)
    const winner = rules[0]!;
    const before  = effective;
    effective     = applyRule(winner, effective);
    stack.push({
      type:     "PRICE_RULE",
      id:       winner.id,
      label:    winner.name,
      savedUsd: r2(Math.max(0, before - effective)),
    });
  } else if (stack.length === 0) {
    // No override, no rule → pure base price
    stack.push({
      type:     "BASE",
      id:       null,
      label:    "Base price",
      savedUsd: "0.00",
    });
  }

  // ── Step 4: Bulk tier ──────────────────────────────────────────────────────
  const bulkPct = await getBulkDiscount(variant.productId, quantity);
  if (bulkPct > 0) {
    const before = effective;
    effective *= (1 - bulkPct / 100);
    stack.push({
      type:     "BULK",
      id:       null,
      label:    `${bulkPct}% bulk discount (qty ${quantity})`,
      savedUsd: r2(Math.max(0, before - effective)),
    });
  }

  return build(variantId, variant, basePrice, effective, stack, isFlashSale, flashSaleId);
}

function build(
  variantId: number,
  variant: { productId: number; priceUsd: string; compareAtPriceUsd: string | null },
  basePrice: number,
  effective: number,
  stack: AppliedStackEntry[],
  isFlashSale: boolean,
  flashSaleId: number | null,
): ResolvedPrice {
  return {
    variantId,
    productId:             variant.productId,
    basePriceUsd:          r2(basePrice),
    compareAtPriceUsd:     variant.compareAtPriceUsd ?? null,
    effectiveUnitPriceUsd: r2(Math.max(0, effective)),
    appliedStack:          stack,
    isFlashSale,
    flashSaleId,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve price for a single variant.
 * Falls back to legacy (base price only) when engine flag is off.
 */
export async function resolvePrice(
  variantId: number,
  quantity = 1,
): Promise<ResolvedPrice> {
  const results = await resolvePriceBatch([variantId], quantity);
  const result  = results.get(variantId);
  if (!result) {
    throw new Error(`resolvePrice: variant ${variantId} not found`);
  }
  return result;
}

/**
 * Resolve prices for multiple variants in one go (batches DB calls).
 * Falls back to legacy when engine flag is off.
 */
export async function resolvePriceBatch(
  variantIds: number[],
  quantity = 1,
): Promise<Map<number, ResolvedPrice>> {
  const resultMap = new Map<number, ResolvedPrice>();
  if (variantIds.length === 0) return resultMap;

  if (!engineEnabled()) {
    // ── Legacy fallback: just return base prices ───────────────────────────
    // orders.ts still handles flash sale + bulk + override inline when flag is off.
    // This path is only called from the new /api/variants/:id/price endpoint,
    // so returning base price is safe — the endpoint will show base price until
    // the flag is enabled.
    const rows = await db
      .select({
        id:               productVariants.id,
        productId:        productVariants.productId,
        priceUsd:         productVariants.priceUsd,
        compareAtPriceUsd: productVariants.compareAtPriceUsd,
        priceOverrideUsd: productVariants.priceOverrideUsd,
      })
      .from(productVariants)
      .where(
        variantIds.length === 1
          ? eq(productVariants.id, variantIds[0]!)
          : or(...variantIds.map((id) => eq(productVariants.id, id))),
      );

    for (const row of rows) {
      const base = parseFloat(row.priceOverrideUsd ?? row.priceUsd);
      resultMap.set(row.id, {
        variantId:             row.id,
        productId:             row.productId,
        basePriceUsd:          row.priceUsd,
        compareAtPriceUsd:     row.compareAtPriceUsd ?? null,
        effectiveUnitPriceUsd: r2(base),
        appliedStack:          [{ type: "BASE", id: null, label: "Base price", savedUsd: "0.00" }],
        isFlashSale:           false,
        flashSaleId:           null,
      });
    }
    return resultMap;
  }

  // ── Engine path ────────────────────────────────────────────────────────────

  // Batch fetch variants + their product categoryId in one join
  const variantRows = await db
    .select({
      id:               productVariants.id,
      productId:        productVariants.productId,
      priceUsd:         productVariants.priceUsd,
      compareAtPriceUsd: productVariants.compareAtPriceUsd,
      priceOverrideUsd: productVariants.priceOverrideUsd,
      categoryId:       products.categoryId,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      variantIds.length === 1
        ? eq(productVariants.id, variantIds[0]!)
        : or(...variantIds.map((id) => eq(productVariants.id, id))),
    );

  if (variantRows.length === 0) return resultMap;

  // Batch flash sale lookup (single query for all variants)
  const flashMap = await getFlashSaleInfo(variantRows.map((v) => v.id));

  // Resolve each variant (price_rules and bulk queries are per-variant;
  // acceptable for typical cart sizes of 1–10 items)
  const results = await Promise.allSettled(
    variantRows.map((v) => resolveOne(v.id, quantity, flashMap, v)),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      resultMap.set(result.value.variantId, result.value);
    } else {
      logger.error({ err: result.reason }, "resolvePriceBatch: variant resolution failed");
    }
  }

  return resultMap;
}
