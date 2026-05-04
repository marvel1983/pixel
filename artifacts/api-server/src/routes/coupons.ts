import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { coupons } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

const validateSchema = z.object({
  code: z.string().min(1).max(50),
  cartProductIds: z.array(z.number().int().positive()).optional(),
});

router.post("/coupons/validate", async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ valid: false, error: "Invalid request" });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const cartProductIds = parsed.data.cartProductIds ?? [];

  const [dbCoupon] = await db.select().from(coupons)
    .where(and(
      eq(sql`UPPER(${coupons.code})`, code),
      eq(coupons.isActive, true),
    )).limit(1);

  if (dbCoupon) {
    if (dbCoupon.expiresAt && new Date() > dbCoupon.expiresAt) {
      res.status(404).json({ valid: false, error: "This coupon has expired." });
      return;
    }
    if (dbCoupon.usageLimit && dbCoupon.usedCount >= dbCoupon.usageLimit) {
      res.status(404).json({ valid: false, error: "This coupon has been fully redeemed." });
      return;
    }

    // Check product restrictions against the cart when provided
    const couponProductIds = Array.isArray(dbCoupon.productIds) && dbCoupon.productIds.length > 0
      ? dbCoupon.productIds as number[]
      : null;
    if (couponProductIds && cartProductIds.length > 0) {
      const eligible = couponProductIds.some((id) => cartProductIds.includes(id));
      if (!eligible) {
        res.status(404).json({ valid: false, error: "This coupon is not valid for the items in your cart." });
        return;
      }
    }

    const discount = parseFloat(dbCoupon.discountValue);
    const isPercentage = dbCoupon.discountType === "PERCENTAGE";
    const productIds = Array.isArray(dbCoupon.productIds) && dbCoupon.productIds.length > 0
      ? dbCoupon.productIds as number[]
      : null;
    res.json({
      valid: true,
      code: dbCoupon.code,
      discount,
      discountType: dbCoupon.discountType,
      label: isPercentage ? `${discount}% off` : `$${discount} off`,
      productIds,
    });
    return;
  }

  res.status(404).json({ valid: false, error: "This coupon code is not valid or has expired." });
});

export default router;
