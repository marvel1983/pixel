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
    const sendAfter = new Date(cart.createdAt.getTime() + delayMs);
    if (new Date() < sendAfter) continue;

    await sendEmailForCart(cart, nextEmail, settings, siteName);
    sent++;
  }

  return { sent };
}

async function sendEmailForCart(
  cart: typeof abandonedCarts.$inferSelect,
  emailNumber: number,
  settings: NonNullable<Awaited<ReturnType<typeof getSettings>>>,
  siteName: string,
) {
  let couponCode: string | undefined;
  if (emailNumber === 3) {
    couponCode = await createRecoveryCoupon(settings.discountPercent, settings.expirationDays);
    await db.update(abandonedCarts).set({ couponCode }).where(eq(abandonedCarts.id, cart.id));
  }

  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0] || "localhost";
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
  const recoveryUrl = `${baseUrl}/cart/recover/${cart.recoveryToken}`;
  const { subject, html } = abandonedCartEmail({
    emailNumber, siteName,
    items: cart.cartData.items, total: cart.cartTotal,
    recoveryUrl, unsubscribeUrl: `${recoveryUrl}?action=unsubscribe`,
    couponCode, discountPercent: settings.discountPercent,
  });

  await enqueueEmail(cart.email, subject, html, { type: "abandoned_cart", cartId: cart.id });
  await db.insert(abandonedCartEmails).values({ abandonedCartId: cart.id, emailNumber, subject });
  await db.update(abandonedCarts).set({
    emailsSent: emailNumber, lastEmailAt: new Date(), updatedAt: new Date(),
  }).where(eq(abandonedCarts.id, cart.id));
}

export async function sendCartEmailNow(cartId: number): Promise<boolean> {
  const settings = await getSettings();
  if (!settings) return false;

  const [cart] = await db.select().from(abandonedCarts)
    .where(and(eq(abandonedCarts.id, cartId), eq(abandonedCarts.status, "ACTIVE")));
  if (!cart || cart.emailsSent >= 3) return false;

  const siteName = await getSiteName();
  await sendEmailForCart(cart, cart.emailsSent + 1, settings, siteName);
  return true;
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
