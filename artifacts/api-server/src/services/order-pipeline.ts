import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  users,
  orderStatusEnum,
  flashSaleProducts,
} from "@workspace/db/schema";
import { processPayment } from "./payment";
import { createGiftCardForOrder, sendGiftCardEmails, redeemGiftCards } from "./gift-card-service";
import { createCommissionForOrder } from "./affiliate-service";
import { markCartRecovered } from "./abandoned-cart-service";
import { awardOrderPoints, redeemPoints, getOrCreateAccount } from "./loyalty-service";
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
  affiliateRefCode?: string;
  flashVariantMap?: Map<number, number>;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  userId?: number;
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

    if (input.loyaltyPointsUsed && input.loyaltyPointsUsed > 0 && input.userId) {
      try {
        const acct = await getOrCreateAccount(input.userId);
        await redeemPoints(acct.id, input.loyaltyPointsUsed, order.id);
      } catch (err) {
        logger.error({ err, orderNumber }, "Loyalty redemption failed after payment; points not deducted");
      }
    }

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
        await redeemGiftCards(order.id, input.giftCards, tx as typeof db);
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

    if (input.flashVariantMap?.size) {
      incrementFlashSaleSoldCounts(input.flashVariantMap, items).catch((err) => {
        logger.error({ err, orderNumber }, "Failed to increment flash sale sold counts (non-fatal)");
      });
    }

    if (input.affiliateRefCode) {
      createCommissionForOrder(input.affiliateRefCode, order.id, total).catch((err) => {
        logger.error({ err, orderNumber }, "Failed to create affiliate commission (non-fatal)");
      });
    }

    markCartRecovered(billing.email, order.id).catch((err) => {
      logger.error({ err, orderNumber }, "Failed to mark cart recovered (non-fatal)");
    });

    if (input.userId) {
      awardOrderPoints(input.userId, order.id, total).catch((err) => {
        logger.error({ err, orderNumber }, "Failed to award loyalty points (non-fatal)");
      });
    } else {
      const [eu] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, billing.email)).limit(1);
      if (eu) {
        awardOrderPoints(eu.id, order.id, total).catch((err) => {
          logger.error({ err, orderNumber }, "Failed to award loyalty points (non-fatal)");
        });
      }
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

async function incrementFlashSaleSoldCounts(
  flashVariantMap: Map<number, number>,
  items: OrderInput["items"],
) {
  const qtyMap = new Map<string, { variantId: number; flashSaleId: number; qty: number }>();
  for (const item of items) {
    const flashSaleId = flashVariantMap.get(item.variantId);
    if (flashSaleId === undefined) continue;
    const key = `${flashSaleId}-${item.variantId}`;
    const existing = qtyMap.get(key);
    if (existing) existing.qty += item.quantity;
    else qtyMap.set(key, { variantId: item.variantId, flashSaleId, qty: item.quantity });
  }
  for (const { variantId, flashSaleId, qty } of qtyMap.values()) {
    await db.update(flashSaleProducts)
      .set({ soldCount: sql`LEAST(${flashSaleProducts.soldCount} + ${qty}, ${flashSaleProducts.maxQuantity})` })
      .where(and(eq(flashSaleProducts.variantId, variantId), eq(flashSaleProducts.flashSaleId, flashSaleId)));
  }
  logger.info({ count: qtyMap.size }, "Flash sale sold counts incremented");
}
