import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { coupons } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const VALID_COUPONS: Record<string, { discount: number; label: string }> = {
  SAVE10: { discount: 10, label: "10% off" },
  WELCOME15: { discount: 15, label: "15% off" },
  PIXEL20: { discount: 20, label: "20% off" },
};

const validateSchema = z.object({
  code: z.string().min(1).max(50),
});

router.post("/coupons/validate", async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ valid: false, error: "Invalid request" });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const hardcoded = VALID_COUPONS[code];

  if (hardcoded) {
    res.json({ valid: true, code, discount: hardcoded.discount, label: hardcoded.label });
    return;
  }

  const [dbCoupon] = await db.select().from(coupons)
    .where(and(
      eq(coupons.code, code),
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
    const discount = parseFloat(dbCoupon.discountValue);
    const isPercentage = dbCoupon.discountType === "PERCENTAGE";
    res.json({
      valid: true,
      code: dbCoupon.code,
      discount,
      discountType: dbCoupon.discountType,
      label: isPercentage ? `${discount}% off` : `$${discount} off`,
    });
    return;
  }

  res.status(404).json({ valid: false, error: "This coupon code is not valid or has expired." });
});

export default router;
