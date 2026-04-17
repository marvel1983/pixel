/**
 * pricing.ts — Public price-resolution endpoint (Phase 2)
 *
 * GET  /api/variants/:id/price?qty=1
 *   Returns a ResolvedPrice for a single variant.
 *   Optional `qty` query param (default 1) used for bulk-tier evaluation.
 *
 * GET  /api/variants/price-batch
 *   Body: { variantIds: number[], qty?: number }
 *   Returns a map of variantId → ResolvedPrice for multiple variants at once.
 *   Used by cart and checkout summary panels.
 *
 * Both endpoints work with the feature flag off (returns base price).
 */

import { Router } from "express";
import { inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { productVariants } from "@workspace/db/schema";
import { paramString } from "../lib/route-params";
import { resolvePrice, resolvePriceBatch } from "../services/resolve-price";
import { logger } from "../lib/logger";

const router = Router();

// ── Stock batch (for cart sync) ───────────────────────────────────────────────

router.post("/variants/stock-batch", async (req, res) => {
  const { variantIds } = req.body as { variantIds?: unknown };
  if (!Array.isArray(variantIds) || variantIds.length === 0) {
    res.status(400).json({ error: "variantIds must be a non-empty array" });
    return;
  }
  const ids = variantIds.map(Number).filter((v) => Number.isInteger(v) && v > 0);
  if (ids.length === 0) { res.status(400).json({ error: "No valid ids" }); return; }

  const rows = await db
    .select({
      id: productVariants.id,
      stockCount: productVariants.stockCount,
      backorderAllowed: productVariants.backorderAllowed,
      backorderEta: productVariants.backorderEta,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, ids));

  const stock: Record<number, { stockCount: number; backorderAllowed: boolean; backorderEta: string | null }> = {};
  for (const r of rows) {
    stock[r.id] = { stockCount: r.stockCount, backorderAllowed: r.backorderAllowed, backorderEta: r.backorderEta ?? null };
  }
  res.json({ stock });
});

// ── Single variant ────────────────────────────────────────────────────────────

router.get("/variants/:id/price", async (req, res) => {
  const id = parseInt(paramString(req.params, "id"));
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid variant id" });
    return;
  }

  const qty = Math.max(1, Number(req.query.qty) || 1);

  try {
    const resolved = await resolvePrice(id, qty);
    res.json({ price: resolved });
  } catch (err) {
    logger.warn({ err, variantId: id }, "GET /api/variants/:id/price — variant not found or error");
    res.status(404).json({ error: "Variant not found" });
  }
});

// ── Batch (POST to avoid long query strings) ───────────────────────────────────

router.post("/variants/price-batch", async (req, res) => {
  const { variantIds, qty } = req.body as { variantIds?: unknown; qty?: unknown };

  if (!Array.isArray(variantIds) || variantIds.length === 0) {
    res.status(400).json({ error: "variantIds must be a non-empty array" });
    return;
  }

  const ids = variantIds
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v > 0);

  if (ids.length === 0) {
    res.status(400).json({ error: "No valid variant ids provided" });
    return;
  }

  if (ids.length > 200) {
    res.status(400).json({ error: "Batch size limit is 200 variants" });
    return;
  }

  const quantity = Math.max(1, Number(qty) || 1);

  try {
    const resultMap = await resolvePriceBatch(ids, quantity);
    // Serialise Map → plain object for JSON
    const prices: Record<number, unknown> = {};
    for (const [variantId, resolved] of resultMap) {
      prices[variantId] = resolved;
    }
    res.json({ prices });
  } catch (err) {
    logger.error({ err }, "POST /api/variants/price-batch — unexpected error");
    res.status(500).json({ error: "Price resolution failed" });
  }
});

export default router;
