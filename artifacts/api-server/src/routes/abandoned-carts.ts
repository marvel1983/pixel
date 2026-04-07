import { Router } from "express";
import { db } from "@workspace/db";
import { abandonedCarts, abandonedCartSettings } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import {
  captureAbandonedCart,
  getCartByToken,
  unsubscribeCart,
} from "../services/abandoned-cart-service";
import { z } from "zod";

const router = Router();

const captureSchema = z.object({
  email: z.string().email(),
  cartData: z.object({
    items: z.array(z.object({
      variantId: z.number(),
      productId: z.number(),
      productName: z.string(),
      variantName: z.string(),
      quantity: z.number(),
      priceUsd: z.string(),
      imageUrl: z.string().optional(),
    })),
    coupon: z.string().optional(),
  }),
  cartTotal: z.number().min(0),
});

router.post("/cart/capture", async (req, res) => {
  try {
    const parsed = captureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid cart data" });
      return;
    }

    const userId = req.user?.userId;
    const { email, cartData, cartTotal } = parsed.data;
    const result = await captureAbandonedCart(email, cartData, cartTotal, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to capture cart" });
  }
});

router.get("/cart/recover/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { action } = req.query;

    if (action === "unsubscribe") {
      const ok = await unsubscribeCart(token);
      res.json({ unsubscribed: ok });
      return;
    }

    const cart = await getCartByToken(token);
    if (!cart) {
      res.status(404).json({ error: "Cart not found or expired" });
      return;
    }

    if (cart.status !== "ACTIVE") {
      res.json({ cart: null, status: cart.status, message: "This cart is no longer available" });
      return;
    }

    res.json({
      cart: {
        items: cart.cartData.items,
        coupon: cart.couponCode || cart.cartData.coupon,
        total: cart.cartTotal,
      },
      status: cart.status,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to recover cart" });
  }
});

router.get("/abandoned-cart-settings/public", async (_req, res) => {
  const [settings] = await db.select().from(abandonedCartSettings);
  res.json({ enabled: settings?.enabled ?? false });
});

export default router;
