import { Router } from "express";
import { eq, and, or } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, siteSettings, users } from "@workspace/db/schema";
import { verifyToken } from "../middleware/auth";
import { generateInvoicePdf } from "../lib/email/invoice-pdf";
import type { InvoiceData } from "../lib/email/invoice-template";
import { logger } from "../lib/logger";

const router = Router();

function resolveLogoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const siteUrl = (process.env.SITE_URL ?? "https://diginek.com").replace(/\/$/, "");
  return `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

router.get("/orders/:orderNumber/invoice.pdf", async (req, res) => {
  // Require auth
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }

  let userId: number;
  try {
    userId = verifyToken(token).userId;
  } catch {
    res.status(401).json({ error: "Invalid token" }); return;
  }

  const { orderNumber } = req.params;

  try {
    // Look up user's email so we can also match guest orders stored by email
    const [userRow] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    const userEmail = userRow?.email ?? "";

    const [order] = await db
      .select()
      .from(orders)
      .where(and(
        eq(orders.orderNumber, orderNumber),
        or(eq(orders.userId, userId), eq(orders.guestEmail, userEmail)),
      ))
      .limit(1);

    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const [settings] = await db
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

    const billing = order.billingSnapshot ?? {
      firstName: "Customer", lastName: "", email: "", country: "", city: "", address: "", zip: "",
    };

    const invoiceData: InvoiceData = {
      invoiceNumber: order.orderNumber,
      invoiceDate: new Date(order.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      siteName: settings?.siteName ?? "PixelCodes",
      logoUrl: resolveLogoUrl(settings?.logoUrl),
      seller: {
        name: settings?.companyName ?? settings?.siteName ?? "PixelCodes",
        address: settings?.companyAddress ?? null,
        city: settings?.companyCity ?? null,
        country: settings?.companyCountry ?? null,
        taxId: settings?.companyTaxId ?? null,
        email: settings?.contactEmail ?? null,
      },
      buyer: {
        firstName: billing.firstName,
        lastName: billing.lastName,
        email: billing.email,
        address: billing.address ?? null,
        city: billing.city ?? null,
        country: billing.country ?? null,
        vatNumber: billing.vatNumber ?? null,
      },
      items: items.map((it) => ({
        name: it.productName,
        variant: it.variantName,
        quantity: it.quantity,
        unitPriceUsd: parseFloat(it.priceUsd),
      })),
      subtotalUsd: parseFloat(order.subtotalUsd),
      discountUsd: parseFloat(order.discountUsd ?? "0"),
      processingFeeUsd: Math.max(0,
        parseFloat(order.totalUsd)
        - (parseFloat(order.subtotalUsd) - parseFloat(order.discountUsd ?? "0"))
        - parseFloat(order.taxAmountUsd ?? "0")
        - parseFloat(order.cppAmountUsd ?? "0"),
      ),
      taxRate: parseFloat(order.taxRate ?? "0"),
      taxAmountUsd: parseFloat(order.taxAmountUsd ?? "0"),
      totalUsd: parseFloat(order.totalUsd),
      currencyCode: order.currencyCode ?? "EUR",
      currencyRate: parseFloat(order.currencyRate ?? "1"),
      paymentMethod: order.paymentMethod ?? "CARD",
    };

    const pdf = await generateInvoicePdf(invoiceData);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${order.orderNumber}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  } catch (err) {
    logger.error({ err }, "Failed to generate invoice PDF");
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

export default router;
