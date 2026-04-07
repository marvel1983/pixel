import { Router } from "express";
import { z } from "zod";

const router = Router();

const VALID_COUPONS: Record<string, { discount: number; label: string }> = {
  SAVE10: { discount: 10, label: "10% off" },
  WELCOME15: { discount: 15, label: "15% off" },
  PIXEL20: { discount: 20, label: "20% off" },
};

const validateSchema = z.object({
  code: z.string().min(1).max(50),
});

router.post("/coupons/validate", (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ valid: false, error: "Invalid request" });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();
  const coupon = VALID_COUPONS[code];

  if (coupon) {
    res.json({
      valid: true,
      code,
      discount: coupon.discount,
      label: coupon.label,
    });
  } else {
    res.status(404).json({
      valid: false,
      error: "This coupon code is not valid or has expired.",
    });
  }
});

export default router;
