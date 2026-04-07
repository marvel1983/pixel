import { eq, and, gte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  users,
  orderStatusEnum,
  giftCards,
  giftCardRedemptions,
} from "@workspace/db/schema";
import { processPayment } from "./payment";
import { createGiftCardForOrder, sendGiftCardEmails } from "./gift-card-service";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createOrder as metenziCreateOrder } from "../lib/metenzi-endpoints";
import { logger } from "../lib/logger";
import { sendOrderConfirmationOnly, triggerOrderEmails } from "./order-emails";
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
    platform?: string;
  }>;
  coupon: { code: string; pct: number; label: string } | null;
  cppSelected: boolean;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  vatNumber: string | null;
  total: number;
  orderNumber: string;
  cardToken: string;
  guestPassword?: string;
  giftCards?: Array<{ code: string; amount: number }>;
}

export async function executeOrderPipeline(input: OrderInput) {
  const { billing, items, orderNumber, total } = input;

  const cppAmount = input.cppSelected ? Math.round(input.subtotal * 0.05 * 100) / 100 : 0;

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
      cppSelected: input.cppSelected,
      cppAmountUsd: cppAmount.toFixed(2),
      taxRate: input.taxRate.toFixed(2),
      taxAmountUsd: input.taxAmount.toFixed(2),
      vatNumber: input.vatNumber,
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

    if (input.guestPassword) {
      await createGuestAccount(billing, input.guestPassword);
    }

    const realItems = items.filter((i) => i.variantId > 0);
    const giftCardItems = items.filter((i) => i.platform?.startsWith("GIFTCARD|"));

    let purchaserUserId: number | null = null;
    if (giftCardItems.length) {
      const [existingUser] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, billing.email)).limit(1);
      purchaserUserId = existingUser?.id ?? null;
    }

    const { insertedItems, createdCards } = await db.transaction(async (tx) => {
      const insertableItems = realItems.length ? realItems : [];
      const inserted = insertableItems.length ? await tx
        .insert(orderItems)
        .values(insertableItems.map((item) => ({
          orderId: order.id, variantId: item.variantId,
          productName: item.productName, variantName: item.variantName,
          priceUsd: item.priceUsd, quantity: item.quantity,
        })))
        .returning({ id: orderItems.id, variantId: orderItems.variantId }) : [];

      const cards: Awaited<ReturnType<typeof createGiftCardForOrder>>[] = [];
      for (const gcItem of giftCardItems) {
        const parts = (gcItem.platform || "").split("|");
        const [, recipientEmail, recipientName, senderName, personalMessage] = parts;
        const qty = Math.max(1, gcItem.quantity);
        for (let q = 0; q < qty; q++) {
          const card = await createGiftCardForOrder(
            order.id, purchaserUserId, gcItem.priceUsd,
            recipientEmail || billing.email, recipientName || "",
            senderName || "", personalMessage || "", tx as typeof db,
          );
          cards.push(card);
        }
      }

      if (input.giftCards?.length) {
        for (const gc of input.giftCards) {
          const code = gc.code.trim().toUpperCase();
          const [card] = await tx.select().from(giftCards)
            .where(and(eq(giftCards.code, code), eq(giftCards.status, "ACTIVE")));
          if (!card) throw new Error(`Gift card ${code} is no longer valid`);
          const balanceBefore = parseFloat(card.balanceUsd);
          const deductAmount = Math.min(gc.amount, balanceBefore);
          if (deductAmount <= 0) throw new Error(`Gift card ${code} has no balance`);
          const balanceAfter = Math.max(0, balanceBefore - deductAmount);
          const updated = await tx.update(giftCards).set({
            balanceUsd: balanceAfter.toFixed(2),
            status: balanceAfter <= 0 ? "REDEEMED" : "ACTIVE",
          }).where(and(eq(giftCards.id, card.id), gte(giftCards.balanceUsd, deductAmount.toFixed(2))))
            .returning({ id: giftCards.id });
          if (!updated.length) throw new Error(`Gift card ${code} insufficient balance`);
          await tx.insert(giftCardRedemptions).values({
            giftCardId: card.id, orderId: order.id,
            amountUsd: deductAmount.toFixed(2),
            balanceBefore: balanceBefore.toFixed(2),
            balanceAfter: balanceAfter.toFixed(2),
          });
          logger.info({ code, orderId: order.id, deducted: deductAmount }, "Gift card redeemed");
        }
      }

      return { insertedItems: inserted, createdCards: cards };
    });

    if (createdCards.length) {
      sendGiftCardEmails(createdCards).catch(() => {});
    }

    const metenziFulfilled = insertedItems.length
      ? await fulfillFromMetenzi(order.id, realItems, insertedItems)
      : false;

    if (metenziFulfilled) {
      await updateOrderStatus(order.id, "PROCESSING");
      await sendOrderConfirmationOnly(billing, orderNumber, order.id, items, total);
    } else {
      await updateOrderStatus(order.id, "COMPLETED");
      await triggerOrderEmails(billing, orderNumber, order.id, items, total);
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
  _insertedItems: { id: number; variantId: number }[],
): Promise<boolean> {
  try {
    const config = await getMetenziConfig();
    if (!config) {
      logger.warn({ orderId }, "Metenzi not configured, skipping fulfillment");
      return false;
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
      "Metenzi order placed, awaiting fulfillment webhook",
    );

    return true;
  } catch (err) {
    logger.error({ err, orderId }, "Metenzi fulfillment failed (non-fatal)");
    return false;
  }
}

async function createGuestAccount(billing: OrderInput["billing"], password: string) {
  try {
    const existing = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, billing.email)).limit(1);
    if (existing.length > 0) return;
    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(users).values({
      email: billing.email, passwordHash,
      firstName: billing.firstName, lastName: billing.lastName, role: "CUSTOMER",
    });
    logger.info({ email: billing.email }, "Guest account created");
  } catch (err) {
    logger.error({ err }, "Failed to create guest account (non-fatal)");
  }
}
