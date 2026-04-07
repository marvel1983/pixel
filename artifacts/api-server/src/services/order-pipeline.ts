import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  users,
  licenseKeys,
  orderStatusEnum,
} from "@workspace/db/schema";
import { processPayment } from "./payment";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createOrder as metenziCreateOrder } from "../lib/metenzi-endpoints";
import { encrypt, decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { sendOrderConfirmationEmail, sendKeyDeliveryEmail } from "../lib/email";
import bcrypt from "bcryptjs";

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

interface OrderInput {
  billing: {
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    city: string;
    address: string;
    zip: string;
  };
  items: Array<{
    variantId: number;
    productId: number;
    productName: string;
    variantName: string;
    priceUsd: string;
    quantity: number;
  }>;
  coupon: { code: string; pct: number; label: string } | null;
  cppSelected: boolean;
  subtotal: number;
  discountAmount: number;
  total: number;
  orderNumber: string;
  cardToken: string;
  guestPassword?: string;
}

export async function executeOrderPipeline(input: OrderInput) {
  const { billing, items, orderNumber, total } = input;

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber,
      guestEmail: billing.email,
      status: "PENDING",
      subtotalUsd: input.subtotal.toFixed(2),
      discountUsd: input.discountAmount.toFixed(2),
      totalUsd: total.toFixed(2),
      paymentMethod: "CARD",
    })
    .returning({ id: orders.id });

  try {
    await updateOrderStatus(order.id, "PROCESSING");

    const paymentResult = await processPayment({
      amount: total.toFixed(2),
      currency: "USD",
      cardToken: input.cardToken,
      email: billing.email,
    });

    if (!paymentResult.success) {
      await updateOrderStatus(order.id, "FAILED");
      throw new Error(paymentResult.error ?? "Payment declined");
    }

    await db
      .update(orders)
      .set({ paymentIntentId: paymentResult.paymentIntentId })
      .where(eq(orders.id, order.id));

    const insertedItems = await db
      .insert(orderItems)
      .values(
        items.map((item) => ({
          orderId: order.id,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          priceUsd: item.priceUsd,
          quantity: item.quantity,
        })),
      )
      .returning({ id: orderItems.id, variantId: orderItems.variantId });

    await fulfillFromMetenzi(order.id, items, insertedItems);

    await updateOrderStatus(order.id, "COMPLETED");

    await triggerOrderEmails(billing, orderNumber, order.id, items, total);

    if (input.guestPassword) {
      await createGuestAccount(billing, input.guestPassword);
    }

    logger.info({ orderNumber, total: total.toFixed(2) }, "Order pipeline complete");
    return { orderNumber, status: "COMPLETED" };
  } catch (err) {
    await updateOrderStatus(order.id, "FAILED");
    throw err;
  }
}

async function updateOrderStatus(orderId: number, status: OrderStatus) {
  await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function fulfillFromMetenzi(
  orderId: number,
  items: OrderInput["items"],
  insertedItems: { id: number; variantId: number }[],
) {
  try {
    const config = await getMetenziConfig();
    if (!config) {
      logger.warn({ orderId }, "Metenzi not configured, skipping fulfillment");
      return;
    }

    const metenziItems = items.map((it) => ({
      variantId: String(it.variantId),
      quantity: it.quantity,
    }));

    const metenziOrder = await metenziCreateOrder(config, metenziItems);
    await db
      .update(orders)
      .set({ externalOrderId: metenziOrder.id })
      .where(eq(orders.id, orderId));
    logger.info(
      { orderId, metenziOrderId: metenziOrder.id },
      "Metenzi order created",
    );

    for (const metenziItem of metenziOrder.items) {
      const dbItem = insertedItems.find(
        (i) => String(i.variantId) === metenziItem.variantId,
      );
      if (!dbItem) continue;

      const keysToInsert = Array.from({ length: metenziItem.quantity }, (_, idx) => {
        const encryptedKey = encrypt(
          `KEY-${metenziOrder.id}-${metenziItem.variantId}-${idx}`,
        );
        return {
          variantId: dbItem.variantId,
          keyValue: encryptedKey,
          status: "SOLD" as const,
          source: "API" as const,
          orderItemId: dbItem.id,
          soldAt: new Date(),
        };
      });

      await db.insert(licenseKeys).values(keysToInsert);
    }

    logger.info({ orderId }, "License keys stored");
  } catch (err) {
    logger.error({ err, orderId }, "Metenzi fulfillment failed (non-fatal)");
  }
}

async function triggerOrderEmails(
  billing: OrderInput["billing"],
  orderNumber: string,
  orderId: number,
  items: OrderInput["items"],
  total: number,
) {
  try {
    const emailItems = items.map((it) => ({
      name: it.productName,
      variant: it.variantName,
      quantity: it.quantity,
      price: `$${(parseFloat(it.priceUsd) * it.quantity).toFixed(2)}`,
    }));

    await sendOrderConfirmationEmail(billing.email, {
      orderId,
      orderRef: orderNumber,
      items: emailItems,
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

async function createGuestAccount(
  billing: OrderInput["billing"],
  password: string,
) {
  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, billing.email))
      .limit(1);

    if (existing.length > 0) {
      logger.info({ email: billing.email }, "Guest account already exists");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({
      email: billing.email,
      passwordHash,
      firstName: billing.firstName,
      lastName: billing.lastName,
      role: "CUSTOMER",
    });

    logger.info({ email: billing.email }, "Guest account created");
  } catch (err) {
    logger.error({ err }, "Failed to create guest account (non-fatal)");
  }
}
