import { Router } from "express";
import { db } from "@workspace/db";
import { quoteRequests, bulkPricingTiers } from "@workspace/db/schema";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { paramString } from "../lib/route-params";
import { logger } from "../lib/logger";

const router = Router();

const submitQuoteSchema = z.object({
  companyName: z.string().min(1).max(255),
  contactName: z.string().min(1).max(255),
  contactEmail: z.string().email().max(255),
  phone: z.string().max(50).optional(),
  products: z.array(z.object({
    productId: z.number(),
    productName: z.string(),
    quantity: z.number().min(1),
  })).min(1),
  message: z.string().max(2000).optional(),
});

router.post("/quotes", async (req, res) => {
  try {
    const data = submitQuoteSchema.parse(req.body);
    const [quote] = await db.insert(quoteRequests).values({
      companyName: data.companyName,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      phone: data.phone ?? null,
      products: data.products,
      message: data.message ?? null,
    }).returning();
    res.status(201).json({ success: true, quoteId: quote.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    logger.error({ err }, "Quote submission error:", err);
    res.status(500).json({ error: "Failed to submit quote request" });
  }
});

router.get("/bulk-pricing/:productId", async (req, res) => {
  try {
    const productId = parseInt(paramString(req.params, "productId"), 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }
    const tiers = await db.select().from(bulkPricingTiers)
      .where(and(
        or(eq(bulkPricingTiers.productId, productId), isNull(bulkPricingTiers.productId)),
        eq(bulkPricingTiers.isActive, true),
      ))
      .orderBy(bulkPricingTiers.minQty);
    res.json({ tiers });
  } catch (err) {
    logger.error({ err }, "Bulk pricing fetch error:", err);
    res.status(500).json({ error: "Failed to fetch pricing tiers" });
  }
});

export default router;
