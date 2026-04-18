import { db } from "@workspace/db";
import { siteSettings } from "@workspace/db/schema";
import { enqueueEmail } from "./queue";
import { sendEmail } from "./mailer";
import {
  welcomeEmail,
  orderConfirmationEmail,
  keyDeliveryEmail,
  passwordResetEmail,
} from "./templates";
import { invoiceEmail } from "./invoice-template";
import { generateInvoicePdf } from "./invoice-pdf";
import type {
  OrderConfirmationData,
  KeyDeliveryData,
  PasswordResetData,
} from "./templates";
import type { InvoiceData } from "./invoice-template";

interface SiteBrand {
  siteName: string;
  logoUrl: string | null;
}

async function getSiteBrand(): Promise<SiteBrand> {
  const rows = await db
    .select({ siteName: siteSettings.siteName, logoUrl: siteSettings.logoUrl })
    .from(siteSettings)
    .limit(1);
  return { siteName: rows[0]?.siteName ?? "PixelCodes", logoUrl: resolveLogoUrl(rows[0]?.logoUrl) };
}

function resolveLogoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  // Relative path — prepend site URL
  const siteUrl = (process.env.SITE_URL ?? "https://diginek.com").replace(/\/$/, "");
  return `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

async function getSellerInfo() {
  const rows = await db
    .select({
      siteName: siteSettings.siteName,
      logoUrl: siteSettings.logoUrl,
      companyName: siteSettings.companyName,
      companyAddress: siteSettings.companyAddress,
      companyCity: siteSettings.companyCity,
      companyCountry: siteSettings.companyCountry,
      companyTaxId: siteSettings.companyTaxId,
      contactEmail: siteSettings.contactEmail,
    })
    .from(siteSettings)
    .limit(1);
  const s = rows[0];
  return {
    siteName: s?.siteName ?? "PixelCodes",
    logoUrl: resolveLogoUrl(s?.logoUrl),
    seller: {
      name: s?.companyName ?? s?.siteName ?? "PixelCodes",
      address: s?.companyAddress ?? null,
      city: s?.companyCity ?? null,
      country: s?.companyCountry ?? null,
      taxId: s?.companyTaxId ?? null,
      email: s?.contactEmail ?? null,
    },
  };
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

export async function sendInvoiceEmail(
  to: string,
  data: Omit<InvoiceData, "siteName" | "logoUrl" | "seller">,
): Promise<void> {
  const { siteName, logoUrl, seller } = await getSellerInfo();
  const invoiceData: InvoiceData = { ...data, siteName, logoUrl, seller };
  const { subject, html } = invoiceEmail(invoiceData);
  // Generate PDF attachment and send directly (not queued) so we can attach the PDF
  try {
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    await sendEmail(to, subject, html, [{
      filename: `Invoice-INV-${data.invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }]);
  } catch {
    // Fallback: send HTML-only via queue if PDF generation fails
    await enqueueEmail(to, subject, html, { type: "invoice", orderRef: data.invoiceNumber });
  }
}
