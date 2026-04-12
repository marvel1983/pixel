import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { coupons } from "@workspace/db/schema";
import { logger } from "../lib/logger";

const STATIC_COUPONS: Record<string, { discount: number; label: string }> = {
  SAVE10: { discount: 10, label: "10% off" },
  WELCOME15: { discount: 15, label: "15% off" },
  PIXEL20: { discount: 20, label: "20% off" },
};

export interface ValidatedCoupon {
  code: string;
  /** Percentage discount (0–100). Zero for FIXED type. */
  pct: number;
  /** Fixed dollar discount. Zero for PERCENTAGE type. */
  amount: number;
  /** Human-readable label */
  label: string;
  /** Discount type */
  type: "PERCENTAGE" | "FIXED";
  /** Minimum order subtotal required (USD). null = no minimum. */
  minOrderUsd: number | null;
  /** Cap on the computed percentage discount (USD). null = no cap. */
  maxDiscountUsd: number | null;
  /**
   * Product-level restriction — if non-empty the coupon only applies to these productIds.
   * TODO: enforce in order pipeline (filter coupon-eligible line items).
   */
  productIds: number[] | null;
  /**
   * Category-level restriction — if non-empty the coupon only applies to products in these categories.
   * TODO: enforce in order pipeline (fetch product.categoryId for each line item and filter).
   */
  categoryIds: number[] | null;
}

export async function validateCouponServerSide(
  code: string,
): Promise<ValidatedCoupon | null> {
  const normalized = code.trim().toUpperCase();

  try {
    const [dbCoupon] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.code, normalized), eq(coupons.isActive, true)))
      .limit(1);

    if (dbCoupon) {
      const now = new Date();

      // Bug fix 1: expiresAt never checked
      if (dbCoupon.expiresAt && dbCoupon.expiresAt < now) {
        logger.warn({ code: normalized }, "Coupon expired");
        return null;
      }

      // Check startsAt as well
      if (dbCoupon.startsAt && dbCoupon.startsAt > now) {
        logger.warn({ code: normalized }, "Coupon not yet active");
        return null;
      }

      // Bug fix 2: usageLimit / usedCount never checked
      if (
        dbCoupon.usageLimit !== null &&
        dbCoupon.usageLimit !== undefined &&
        dbCoupon.usedCount >= dbCoupon.usageLimit
      ) {
        logger.warn({ code: normalized, usedCount: dbCoupon.usedCount, usageLimit: dbCoupon.usageLimit }, "Coupon usage limit reached");
        return null;
      }

      const discountValue = parseFloat(dbCoupon.discountValue);

      // Bug fix 4: FIXED discount type returned 0% — now returns correct amount
      const isFixed = dbCoupon.discountType === "FIXED";
      const pct = isFixed ? 0 : discountValue;
      const amount = isFixed ? discountValue : 0;
      const label = isFixed
        ? `-$${discountValue.toFixed(2)} off`
        : `${pct}% off`;

      // Bug fix 3: minOrderUsd returned so orders.ts can enforce it
      const minOrderUsd = dbCoupon.minOrderUsd ? parseFloat(dbCoupon.minOrderUsd) : null;

      // Bug fix 5: maxDiscountUsd returned so orders.ts can cap the computed discount
      const maxDiscountUsd = dbCoupon.maxDiscountUsd ? parseFloat(dbCoupon.maxDiscountUsd) : null;

      // Bug fix 6: productIds / categoryIds returned so the order pipeline can enforce restrictions
      const productIds = Array.isArray(dbCoupon.productIds) && dbCoupon.productIds.length > 0
        ? dbCoupon.productIds
        : null;
      const categoryIds = Array.isArray(dbCoupon.categoryIds) && dbCoupon.categoryIds.length > 0
        ? dbCoupon.categoryIds
        : null;

      return {
        code: dbCoupon.code,
        pct,
        amount,
        label,
        type: dbCoupon.discountType,
        minOrderUsd,
        maxDiscountUsd,
        productIds,
        categoryIds,
      };
    }
  } catch (err) {
    // DB lookup failed, try static fallback
    logger.warn({ err, code: normalized }, "DB coupon lookup failed, using static fallback");
  }

  const staticCoupon = STATIC_COUPONS[normalized];
  if (staticCoupon) {
    return {
      code: normalized,
      pct: staticCoupon.discount,
      amount: 0,
      label: staticCoupon.label,
      type: "PERCENTAGE",
      minOrderUsd: null,
      maxDiscountUsd: null,
      productIds: null,
      categoryIds: null,
    };
  }

  return null;
}
