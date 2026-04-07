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

async function getSiteName(): Promise<string> {
  const rows = await db.select({ siteName: siteSettings.siteName }).from(siteSettings).limit(1);
  return rows[0]?.siteName ?? "PixelCodes";
}

export async function sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  const siteName = await getSiteName();
  const { subject, html } = welcomeEmail({ firstName, siteName });
  await enqueueEmail(to, subject, html, { type: "welcome" });
}

export async function sendOrderConfirmationEmail(
  to: string,
  data: Omit<OrderConfirmationData, "siteName">,
): Promise<void> {
  const siteName = await getSiteName();
  const { subject, html } = orderConfirmationEmail({ ...data, siteName });
  await enqueueEmail(to, subject, html, { type: "order_confirmation", orderId: data.orderId });
}

export async function sendKeyDeliveryEmail(
  to: string,
  data: Omit<KeyDeliveryData, "siteName">,
): Promise<void> {
  const siteName = await getSiteName();
  const { subject, html } = keyDeliveryEmail({ ...data, siteName });
  await enqueueEmail(to, subject, html, { type: "key_delivery", orderRef: data.orderRef });
}

export async function sendPasswordResetEmail(
  to: string,
  data: Omit<PasswordResetData, "siteName">,
): Promise<void> {
  const siteName = await getSiteName();
  const { subject, html } = passwordResetEmail({ ...data, siteName });
  await enqueueEmail(to, subject, html, { type: "password_reset" });
}
