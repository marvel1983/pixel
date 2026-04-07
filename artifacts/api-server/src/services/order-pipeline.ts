import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { orders, orderItems, users, licenseKeys } from "@workspace/db/schema";
import { processPayment } from "./payment";
import { logger } from "../lib/logger";
import bcrypt from "bcryptjs";

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
    await db
      .update(orders)
      .set({ status: "PROCESSING" })
      .where(eq(orders.id, order.id));

    const paymentResult = await processPayment({
      amount: total.toFixed(2),
      currency: "USD",
      cardToken: input.cardToken,
      email: billing.email,
    });

    if (!paymentResult.success) {
      await db
        .update(orders)
        .set({ status: "FAILED" })
        .where(eq(orders.id, order.id));
      throw new Error(paymentResult.error ?? "Payment declined");
    }

    await db
      .update(orders)
      .set({ paymentIntentId: paymentResult.paymentIntentId })
      .where(eq(orders.id, order.id));

    await db.insert(orderItems).values(
      items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        priceUsd: item.priceUsd,
        quantity: item.quantity,
      })),
    );

    await db
      .update(orders)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    if (input.guestPassword) {
      await createGuestAccount(billing, input.guestPassword);
    }

    logger.info({ orderNumber, total: total.toFixed(2) }, "Order pipeline complete");

    return { orderNumber, status: "COMPLETED" };
  } catch (err) {
    await db
      .update(orders)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    throw err;
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
