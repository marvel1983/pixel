import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { orderItems, licenseKeys } from "@workspace/db/schema";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { sendOrderConfirmationEmail, sendKeyDeliveryEmail } from "../lib/email";

interface BillingInfo {
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  address: string;
  zip: string;
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

export async function sendOrderConfirmationOnly(
  billing: BillingInfo,
  orderNumber: string,
  orderId: number,
  items: ItemInfo[],
  total: number,
) {
  try {
    await sendOrderConfirmationEmail(billing.email, {
      orderId,
      orderRef: orderNumber,
      items: buildEmailItems(items),
      total: `$${total.toFixed(2)}`,
      customerName: billing.firstName,
    });
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
) {
  try {
    await sendOrderConfirmationEmail(billing.email, {
      orderId,
      orderRef: orderNumber,
      items: buildEmailItems(items),
      total: `$${total.toFixed(2)}`,
      customerName: billing.firstName,
    });

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
      });
    }
  } catch (err) {
    logger.error({ err, orderNumber }, "Failed to enqueue order emails (non-fatal)");
  }
}
