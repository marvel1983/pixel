import { db } from "@workspace/db";
import {
  productAlerts,
  alertNotifications,
  products,
  productVariants,
  siteSettings,
} from "@workspace/db/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { enqueueEmail } from "../lib/email/queue";
import { priceDropEmail, backInStockEmail } from "./alert-emails";
import { logger } from "../lib/logger";

async function getSiteName(): Promise<string> {
  const [row] = await db.select({ n: siteSettings.siteName }).from(siteSettings).limit(1);
  return row?.n ?? "PixelCodes";
}

function getBaseUrl(): string {
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0] || "localhost";
  return domain.startsWith("http") ? domain : `https://${domain}`;
}

export async function checkPriceDropAlerts(
  variantId: number,
  oldPrice: string,
  newPrice: string,
): Promise<number> {
  const oldNum = parseFloat(oldPrice);
  const newNum = parseFloat(newPrice);
  if (newNum >= oldNum) return 0;

  const alerts = await db.select({
    alert: productAlerts,
    productName: products.name,
    productSlug: products.slug,
    imageUrl: products.imageUrl,
  })
    .from(productAlerts)
    .innerJoin(products, eq(products.id, productAlerts.productId))
    .where(and(
      eq(productAlerts.isActive, true),
      eq(productAlerts.alertType, "PRICE_DROP"),
      isNull(productAlerts.notifiedAt),
    ));

  const matching = alerts.filter((a) =>
    (a.alert.variantId === variantId || !a.alert.variantId) &&
    (!a.alert.targetPriceUsd || newNum <= parseFloat(a.alert.targetPriceUsd)),
  );

  if (matching.length === 0) return 0;

  const siteName = await getSiteName();
  const baseUrl = getBaseUrl();
  let sent = 0;

  for (const row of matching) {
    const productUrl = `${baseUrl}/product/${row.productSlug}`;
    const unsubscribeUrl = `${baseUrl}/api/alerts/${row.alert.id}/unsubscribe`;
    const savings = (oldNum - newNum).toFixed(2);

    const { subject, html } = priceDropEmail({
      siteName, productName: row.productName, productUrl,
      imageUrl: row.imageUrl, oldPrice, newPrice, savings, unsubscribeUrl,
    });

    await enqueueEmail(row.alert.email, subject, html, { type: "price_drop", alertId: row.alert.id });

    await db.insert(alertNotifications).values({
      alertId: row.alert.id, alertType: "PRICE_DROP",
      oldPriceUsd: oldPrice, newPriceUsd: newPrice,
    });

    await db.update(productAlerts).set({ notifiedAt: new Date(), isActive: false })
      .where(eq(productAlerts.id, row.alert.id));

    sent++;
  }

  if (sent > 0) logger.info({ variantId, oldPrice, newPrice, sent }, "Price drop alerts sent");
  return sent;
}

export async function checkBackInStockAlerts(
  variantId: number,
  productId: number,
  oldStock: number,
  newStock: number,
  currentPrice: string,
): Promise<number> {
  if (oldStock > 0 || newStock <= 0) return 0;

  const alerts = await db.select({
    alert: productAlerts,
    productName: products.name,
    productSlug: products.slug,
    imageUrl: products.imageUrl,
  })
    .from(productAlerts)
    .innerJoin(products, eq(products.id, productAlerts.productId))
    .where(and(
      eq(productAlerts.isActive, true),
      eq(productAlerts.alertType, "BACK_IN_STOCK"),
      eq(productAlerts.productId, productId),
      isNull(productAlerts.notifiedAt),
    ));

  const matching = alerts.filter((a) => !a.alert.variantId || a.alert.variantId === variantId);

  if (matching.length === 0) return 0;

  const siteName = await getSiteName();
  const baseUrl = getBaseUrl();
  let sent = 0;

  for (const row of matching) {
    const productUrl = `${baseUrl}/product/${row.productSlug}`;
    const unsubscribeUrl = `${baseUrl}/api/alerts/${row.alert.id}/unsubscribe`;

    const { subject, html } = backInStockEmail({
      siteName, productName: row.productName, productUrl,
      imageUrl: row.imageUrl, price: currentPrice,
      stockCount: newStock, unsubscribeUrl,
    });

    await enqueueEmail(row.alert.email, subject, html, { type: "back_in_stock", alertId: row.alert.id });

    await db.insert(alertNotifications).values({
      alertId: row.alert.id, alertType: "BACK_IN_STOCK",
      newStockCount: newStock, newPriceUsd: currentPrice,
    });

    await db.update(productAlerts).set({ notifiedAt: new Date(), isActive: false })
      .where(eq(productAlerts.id, row.alert.id));

    sent++;
  }

  if (sent > 0) logger.info({ variantId, productId, newStock, sent }, "Back-in-stock alerts sent");
  return sent;
}
