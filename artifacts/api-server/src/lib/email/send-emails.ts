import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { enqueueEmail } from "./queue";
import {
  welcomeEmail,
  orderConfirmationEmail,
  keyDeliveryEmail,
  passwordResetEmail,
} from "./templates";
import type {
  OrderConfirmationData,
  KeyDeliveryData,
  PasswordResetData,
} from "./templates";

interface SiteBrand {
  siteName: string;
  logoUrl: string | null;
}

async function getSiteBrand(): Promise<SiteBrand> {
  const rows = await db
    .select({ siteName: siteSettings.siteName, logoUrl: siteSettings.logoUrl })
    .from(siteSettings)
    .limit(1);
  return { siteName: rows[0]?.siteName ?? "PixelCodes", logoUrl: rows[0]?.logoUrl ?? null };
}

export async function sendWelcomeEmail(to: string, firstName: string, locale?: string): Promise<void> {
  const brand = await getSiteBrand();
  const { subject, html } = welcomeEmail({ firstName, ...brand, locale });
  await enqueueEmail(to, subject, html, { type: "welcome" });
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: Omit<OrderConfirmationData, "siteName" | "logoUrl">,
): Promise<void> {
  const brand = await getSiteBrand();
  const { subject, html } = orderConfirmationEmail({ ...data, ...brand });
  await enqueueEmail(to, subject, html, { type: "order_confirmation", orderId: data.orderId });
}

export async function sendKeyDeliveryEmail(
  to: string,
  data: Omit<KeyDeliveryData, "siteName" | "logoUrl">,
): Promise<void> {
  const brand = await getSiteBrand();
  const { subject, html } = keyDeliveryEmail({ ...data, ...brand });
  await enqueueEmail(to, subject, html, { type: "key_delivery", orderRef: data.orderRef });
}

export async function sendPasswordResetEmail(
  to: string,
  data: Omit<PasswordResetData, "siteName" | "logoUrl">,
): Promise<void> {
  const brand = await getSiteBrand();
  const { subject, html } = passwordResetEmail({ ...data, ...brand });
  await enqueueEmail(to, subject, html, { type: "password_reset" });
}
