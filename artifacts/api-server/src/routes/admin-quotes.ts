import { Router } from "express";
import { db } from "@workspace/db";
import { quoteRequests, bulkPricingTiers, users } from "@workspace/db/schema";
import { eq, desc, and, isNull, or, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { z } from "zod/v4";

const router = Router();
const adminMiddleware = [requireAuth, requireAdmin, requirePermission("manageOrders")];

router.get("/admin/quotes", ...adminMiddleware, async (_req, res) => {
  try {
    const quotes = await db.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt));
    res.json({ quotes });
  } catch (err) {
    console.error("Admin quotes list error:", err);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

router.get("/admin/quotes/:id", ...adminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, id));
    if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json({ quote });
  } catch (err) {
    console.error("Admin quote detail error:", err);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

const updateQuoteSchema = z.object({
  status: z.enum(["NEW", "QUOTED", "ACCEPTED", "DECLINED"]).optional(),
  adminNotes: z.string().max(5000).optional(),
  customPricing: z.array(z.object({
    productId: z.number(),
    productName: z.string(),
    quantity: z.number(),
    unitPrice: z.string(),
  })).optional(),
});

router.put("/admin/quotes/:id", ...adminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = updateQuoteSchema.parse(req.body);
    const [updated] = await db.update(quoteRequests)
      .set({
        ...(data.status && { status: data.status }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
        ...(data.customPricing && { customPricing: data.customPricing }),
        updatedAt: new Date(),
      })
      .where(eq(quoteRequests.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Quote not found" }); return; }
    res.json({ quote: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("Admin quote update error:", err);
    res.status(500).json({ error: "Failed to update quote" });
  }
});

router.get("/admin/bulk-pricing", ...adminMiddleware, async (_req, res) => {
  try {
    const tiers = await db.select().from(bulkPricingTiers).orderBy(bulkPricingTiers.minQty);
    res.json({ tiers });
  } catch (err) {
    console.error("Bulk pricing list error:", err);
    res.status(500).json({ error: "Failed to fetch tiers" });
  }
});

const tierSchema = z.object({
  productId: z.number().nullable().optional(),
  minQty: z.number().min(1),
  maxQty: z.number().nullable().optional(),
  discountPercent: z.string(),
  isActive: z.boolean().optional(),
});

router.post("/admin/bulk-pricing", ...adminMiddleware, async (req, res) => {
  try {
    const data = tierSchema.parse(req.body);
    const [tier] = await db.insert(bulkPricingTiers).values({
      productId: data.productId ?? null,
      minQty: data.minQty,
      maxQty: data.maxQty ?? null,
      discountPercent: data.discountPercent,
      isActive: data.isActive ?? true,
    }).returning();
    res.status(201).json({ tier });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("Bulk pricing create error:", err);
    res.status(500).json({ error: "Failed to create tier" });
  }
});

router.put("/admin/bulk-pricing/:id", ...adminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const data = tierSchema.parse(req.body);
    const [updated] = await db.update(bulkPricingTiers)
      .set({
        productId: data.productId ?? null,
        minQty: data.minQty,
        maxQty: data.maxQty ?? null,
        discountPercent: data.discountPercent,
        isActive: data.isActive ?? true,
      })
      .where(eq(bulkPricingTiers.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Tier not found" }); return; }
    res.json({ tier: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: err.issues });
      return;
    }
    console.error("Bulk pricing update error:", err);
    res.status(500).json({ error: "Failed to update tier" });
  }
});

router.delete("/admin/bulk-pricing/:id", ...adminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(bulkPricingTiers).where(eq(bulkPricingTiers.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("Bulk pricing delete error:", err);
    res.status(500).json({ error: "Failed to delete tier" });
  }
});

router.patch("/admin/users/:id/business", ...adminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { approved, companyName } = req.body;
    const [updated] = await db.update(users)
      .set({
        isBusinessAccount: true,
        businessApproved: !!approved,
        ...(companyName && { companyName }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ user: { id: updated.id, email: updated.email, businessApproved: updated.businessApproved, companyName: updated.companyName } });
  } catch (err) {
    console.error("Business account update error:", err);
    res.status(500).json({ error: "Failed to update business status" });
  }
});

export default router;
