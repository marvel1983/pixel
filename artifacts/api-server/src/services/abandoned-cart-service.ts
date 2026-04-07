import { db } from "@workspace/db";
import {
  abandonedCarts,
  abandonedCartEmails,
  abandonedCartSettings,
  coupons,
} from "@workspace/db/schema";
import { eq, and, sql, lte, isNull } from "drizzle-orm";
import { enqueueEmail } from "../lib/email/queue";
import { abandonedCartEmail } from "./abandoned-cart-emails";
import { logger } from "../lib/logger";
import crypto from "crypto";
import type { CartSnapshot } from "@workspace/db/schema";

async function getSettings() {
  const [s] = await db.select().from(abandonedCartSettings);
  return s;
}

async function getSiteName(): Promise<string> {
  const { siteSettings } = await import("@workspace/db/schema");
  const [row] = await db.select({ n: siteSettings.siteName }).from(siteSettings).limit(1);
  return row?.n ?? "PixelCodes";
}

export async function captureAbandonedCart(
  email: string,
  cartData: CartSnapshot,
  cartTotal: number,
  userId?: number,
): Promise<{ token: string }> {
  const settings = await getSettings();
  if (!settings?.enabled) return { token: "" };

  const minVal = parseFloat(settings.minCartValue || "5");
  if (cartTotal < minVal) return { token: "" };

  const existing = await db.select({ id: abandonedCarts.id })
    .from(abandonedCarts)
    .where(and(eq(abandonedCarts.email, email), eq(abandonedCarts.status, "ACTIVE")));

  for (const row of existing) {
    await db.update(abandonedCarts)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(abandonedCarts.id, row.id));
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(abandonedCarts).values({
    email,
    userId: userId ?? null,
    recoveryToken: token,
    cartData,
    cartTotal: cartTotal.toFixed(2),
    status: "ACTIVE",
  });

  return { token };
}

export async function markCartRecovered(email: string, orderId: number): Promise<void> {
  await db.update(abandonedCarts)
    .set({ status: "RECOVERED", recoveredAt: new Date(), recoveredOrderId: orderId, updatedAt: new Date() })
    .where(and(eq(abandonedCarts.email, email), eq(abandonedCarts.status, "ACTIVE")));
}

export async function processAbandonedCarts(): Promise<{ sent: number }> {
  const settings = await getSettings();
  if (!settings?.enabled) return { sent: 0 };

  const delays = [
    settings.email1DelayMinutes,
    settings.email2DelayMinutes,
    settings.email3DelayMinutes,
  ];
  const siteName = await getSiteName();
  let sent = 0;

  const activeCarts = await db.select().from(abandonedCarts)
    .where(and(
      eq(abandonedCarts.status, "ACTIVE"),
      lte(abandonedCarts.emailsSent, 2),
    ));

  for (const cart of activeCarts) {
    const nextEmail = cart.emailsSent + 1;
    if (nextEmail > 3) continue;

    const delayMs = delays[nextEmail - 1]! * 60 * 1000;
    const referenceTime = cart.lastEmailAt || cart.createdAt;
    const sendAfter = new Date(referenceTime.getTime() + delayMs);
    if (new Date() < sendAfter) continue;

    let couponCode: string | undefined;
    if (nextEmail === 3) {
      couponCode = await createRecoveryCoupon(settings.discountPercent, settings.expirationDays);
      await db.update(abandonedCarts)
        .set({ couponCode })
        .where(eq(abandonedCarts.id, cart.id));
    }

    const recoveryUrl = `${process.env["REPLIT_DEV_DOMAIN"] ? `https://${process.env["REPLIT_DEV_DOMAIN"]}` : ""}/cart/recover/${cart.recoveryToken}`;
    const unsubUrl = `${recoveryUrl}?action=unsubscribe`;
    const { subject, html } = abandonedCartEmail({
      emailNumber: nextEmail,
      siteName,
      items: cart.cartData.items,
      total: cart.cartTotal,
      recoveryUrl,
      unsubscribeUrl: unsubUrl,
      couponCode,
      discountPercent: settings.discountPercent,
    });

    await enqueueEmail(cart.email, subject, html, { type: "abandoned_cart", cartId: cart.id });

    await db.insert(abandonedCartEmails).values({
      abandonedCartId: cart.id,
      emailNumber: nextEmail,
      subject,
    });

    await db.update(abandonedCarts).set({
      emailsSent: nextEmail,
      lastEmailAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(abandonedCarts.id, cart.id));

    sent++;
  }

  return { sent };
}

async function createRecoveryCoupon(discountPercent: number, expirationDays: number): Promise<string> {
  const code = `RECOVER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  await db.insert(coupons).values({
    code,
    description: `Abandoned cart recovery - ${discountPercent}% off`,
    discountType: "PERCENTAGE",
    discountValue: discountPercent.toFixed(2),
    usageLimit: 1,
    usedCount: 0,
    isActive: true,
    singleUsePerCustomer: true,
    expiresAt,
  });

  return code;
}

export async function getCartByToken(token: string) {
  const [cart] = await db.select().from(abandonedCarts)
    .where(eq(abandonedCarts.recoveryToken, token));
  return cart ?? null;
}

export async function unsubscribeCart(token: string): Promise<boolean> {
  const [cart] = await db.select({ id: abandonedCarts.id })
    .from(abandonedCarts)
    .where(eq(abandonedCarts.recoveryToken, token));
  if (!cart) return false;
  await db.update(abandonedCarts)
    .set({ status: "UNSUBSCRIBED", unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(abandonedCarts.id, cart.id));
  return true;
}
