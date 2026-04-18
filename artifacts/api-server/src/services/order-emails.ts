import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { orderItems, licenseKeys, orders } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { sendOrderConfirmationEmail, sendKeyDeliveryEmail, sendInvoiceEmail } from "../lib/email";

interface BillingInfo {
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  address: string;
  zip: string;
  phone?: string;
  vatNumber?: string;
}

interface ItemInfo {
  variantId: number;
  productName: string;
  variantName: string;
  priceUsd: string;
  quantity: number;
}

function buildEmailItems(items: ItemInfo[]) {
  return items.map((it) => ({
    name: it.productName,
    variant: it.variantName,
    quantity: it.quantity,
    price: `$${(parseFloat(it.priceUsd) * it.quantity).toFixed(2)}`,
  }));
}

async function sendOrderInvoice(
  billing: BillingInfo,
  orderNumber: string,
  orderId: number,
  items: ItemInfo[],
) {
  try {
    const [order] = await db
      .select({
        subtotalUsd: orders.subtotalUsd,
        discountUsd: orders.discountUsd,
        totalUsd: orders.totalUsd,
        taxRate: orders.taxRate,
        taxAmountUsd: orders.taxAmountUsd,
        currencyCode: orders.currencyCode,
        currencyRate: orders.currencyRate,
        paymentMethod: orders.paymentMethod,
        vatNumber: orders.vatNumber,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) return;

    await sendInvoiceEmail(billing.email, {
      invoiceNumber: orderNumber,
      invoiceDate: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      buyer: {
        firstName: billing.firstName,
        lastName: billing.lastName,
        email: billing.email,
        address: billing.address || null,
        city: billing.city || null,
        country: billing.country || null,
        vatNumber: billing.vatNumber ?? order.vatNumber ?? null,
      },
      items: items.map((it) => ({
        name: it.productName,
        variant: it.variantName,
        quantity: it.quantity,
        unitPriceUsd: parseFloat(it.priceUsd),
      })),
      subtotalUsd: parseFloat(order.subtotalUsd),
      discountUsd: parseFloat(order.discountUsd),
      taxRate: parseFloat(order.taxRate),
      taxAmountUsd: parseFloat(order.taxAmountUsd),
      totalUsd: parseFloat(order.totalUsd),
      currencyCode: order.currencyCode,
      currencyRate: parseFloat(order.currencyRate),
      paymentMethod: order.paymentMethod ?? "CARD",
    });
  } catch (err) {
    logger.error({ err, orderNumber }, "Failed to send invoice email (non-fatal)");
  }
}

export async function sendOrderConfirmationOnly(
  billing: BillingInfo,
  orderNumber: string,
  orderId: number,
  items: ItemInfo[],
  total: number,
  locale?: string,
) {
  try {
    await sendOrderConfirmationEmail(billing.email, {
      orderId,
      orderRef: orderNumber,
      items: buildEmailItems(items),
      total: `$${total.toFixed(2)}`,
      customerName: billing.firstName,
      locale,
    });
    await sendOrderInvoice(billing, orderNumber, orderId, items);
  } catch (err) {
    logger.error({ err, orderNumber }, "Failed to enqueue confirmation email (non-fatal)");
  }
}

export async function triggerOrderEmails(
  billing: BillingInfo,
  orderNumber: string,
  orderId: number,
  items: ItemInfo[],
  total: number,
  locale?: string,
) {
  try {
    await sendOrderConfirmationEmail(billing.email, {
      orderId,
      orderRef: orderNumber,
      items: buildEmailItems(items),
      total: `$${total.toFixed(2)}`,
      customerName: billing.firstName,
      locale,
    });
    await sendOrderInvoice(billing, orderNumber, orderId, items);

    const deliveredKeys = await db
      .select({
        keyValue: licenseKeys.keyValue,
        variantId: licenseKeys.variantId,
      })
      .from(licenseKeys)
      .innerJoin(orderItems, eq(licenseKeys.orderItemId, orderItems.id))
      .where(eq(orderItems.orderId, orderId));

    if (deliveredKeys.length > 0) {
      const keys = deliveredKeys.map((dk) => {
        const item = items.find((it) => it.variantId === dk.variantId);
        let keyVal: string;
        try {
          keyVal = decrypt(dk.keyValue);
        } catch {
          keyVal = dk.keyValue;
        }
        return {
          productName: item?.productName ?? "Product",
          variant: item?.variantName ?? "Standard",
          licenseKey: keyVal,
        };
      });
      await sendKeyDeliveryEmail(billing.email, {
        orderRef: orderNumber,
        customerName: billing.firstName,
        keys,
        locale,
      });
    }
  } catch (err) {
    logger.error({ err, orderNumber }, "Failed to enqueue order emails (non-fatal)");
  }
}
