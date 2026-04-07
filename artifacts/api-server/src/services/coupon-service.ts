import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { coupons } from "@workspace/db/schema";

const STATIC_COUPONS: Record<string, { discount: number; label: string }> = {
  SAVE10: { discount: 10, label: "10% off" },
  WELCOME15: { discount: 15, label: "15% off" },
  PIXEL20: { discount: 20, label: "20% off" },
};

export interface ValidatedCoupon {
  code: string;
  pct: number;
  label: string;
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
      const pct =
        dbCoupon.discountType === "PERCENTAGE"
          ? parseFloat(dbCoupon.discountValue)
          : 0;
      return {
        code: dbCoupon.code,
        pct,
        label: `${pct}% off`,
      };
    }
  } catch {
    // DB lookup failed, try static fallback
  }

  const staticCoupon = STATIC_COUPONS[normalized];
  if (staticCoupon) {
    return {
      code: normalized,
      pct: staticCoupon.discount,
      label: staticCoupon.label,
    };
  }

  return null;
}
