import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  orders,
  orderItems,
  orderServices,
  users,
  orderStatusEnum,
  flashSaleProducts,
  metenziProductMappings,
} from "@workspace/db/schema";
import { processPayment } from "./payment";
import { createGiftCardForOrder, sendGiftCardEmails, redeemGiftCards } from "./gift-card-service";
import { createCommissionForOrder } from "./affiliate-service";
import { markCartRecovered } from "./abandoned-cart-service";
import { awardOrderPoints, redeemPoints, getOrCreateAccount, restorePoints } from "./loyalty-service";
import { debitWallet, creditWallet } from "./wallet-service";
import { getMetenziConfig } from "../lib/metenzi-config";
import { createOrder as metenziCreateOrder } from "../lib/metenzi-endpoints";
import { logger } from "../lib/logger";
import { enqueueJob } from "../lib/job-queue";
import { CircuitOpenError } from "../lib/circuit-breaker";
import { sendOrderConfirmationOnly, triggerOrderEmails } from "./order-emails";
import { scheduleTrustpilotInvite } from "./trustpilot-service";
import { recordPurchaseEvents } from "./social-proof-service";
import bcrypt from "bcryptjs";

type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

interface BillingInfo {
  email: string; firstName: string; lastName: string;
  country: string; city: string; address: string; zip: string;
  phone: string;
}
interface OrderItem {
  variantId: number; productId: number; productName: string; variantName: string;
  priceUsd: string; quantity: number; platform?: string; bundleId?: number;
  imageUrl?: string | null;
}
interface OrderInput {
  billing: BillingInfo;
  items: OrderItem[];
  coupon: { code: string; pct: number; label: string } | null;
  cppSelected: boolean; subtotal: number; discountAmount: number;
  taxRate: number; taxAmount: number; vatNumber: string | null;
  total: number; orderNumber: string; cardToken: string;
  guestPassword?: string; giftCards?: Array<{ code: string; amount: number }>;
  affiliateRefCode?: string; flashVariantMap?: Map<number, number>;
  loyaltyPointsUsed?: number; loyaltyDiscount?: number;
  walletAmountUsd?: number; userId?: number;
  paymentMethod?: "card" | "net30";
  services?: Array<{ id: number; name: string; priceUsd: string }>;
  locale?: string;
}

export interface FulfillmentInput {
  billing: BillingInfo;
  items: OrderItem[];
  giftCards?: Array<{ code: string; amount: number }>;
  affiliateRefCode?: string;
  flashVariantMap?: Map<number, number>;
  loyaltyPointsUsed?: number;
  services?: Array<{ id: number; name: string; priceUsd: string }>;
  guestPassword?: string;   // raw password (wallet/Net30 path only)
  guestPasswordHash?: string; // pre-hashed (Stripe/Checkout.com webhook path)
  locale?: string;
  userId?: number;
}

/**
 * Runs all post-payment fulfillment steps: inserts order items, redeems gift cards,
 * fulfills via Metenzi, sends emails, and fires non-critical side effects.
 * Called both by executeOrderPipeline (sync path) and the Stripe webhook (async path).
 */
export async function runFulfillment(
  orderId: number,
  orderNumber: string,
  paymentIntentId: string,
  input: FulfillmentInput,
  total: number,
): Promise<void> {
  const { billing, items } = input;

  await db.update(orders).set({ paymentIntentId }).where(eq(orders.id, orderId));

  if (input.guestPasswordHash) await createGuestAccountFromHash(billing, input.guestPasswordHash);
  else if (input.guestPassword) await createGuestAccount(billing, input.guestPassword);

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
        orderId, variantId: item.variantId,
        productName: item.productName, variantName: item.variantName,
        priceUsd: item.priceUsd, quantity: item.quantity,
        bundleId: item.bundleId ?? null,
      })))
      .returning({ id: orderItems.id, variantId: orderItems.variantId }) : [];

    const cards: Awaited<ReturnType<typeof createGiftCardForOrder>>[] = [];
    for (const gcItem of giftCardItems) {
      const parts = (gcItem.platform || "").split("|");
      const [, recipientEmail, recipientName, senderName, personalMessage] = parts;
      const qty = Math.max(1, gcItem.quantity);
      for (let q = 0; q < qty; q++) {
        const card = await createGiftCardForOrder(
          orderId, purchaserUserId, gcItem.priceUsd,
          recipientEmail || billing.email, recipientName || "",
          senderName || "", personalMessage || "", tx as unknown as typeof db,
        );
        cards.push(card);
      }
    }

    if (input.giftCards?.length) {
      await redeemGiftCards(orderId, input.giftCards, tx as unknown as typeof db);
    }

    if (input.services?.length) {
      await tx.insert(orderServices).values(
        input.services.map((s) => ({
          orderId, serviceId: s.id,
          serviceName: s.name, priceUsd: s.priceUsd,
        })),
      );
    }

    return { insertedItems: inserted, createdCards: cards };
  });

  if (createdCards.length) {
    sendGiftCardEmails(createdCards).catch(() => {});
  }

  const metenziFulfilled = insertedItems.length
    ? await fulfillFromMetenzi(orderId, realItems, insertedItems)
    : false;

  if (metenziFulfilled) {
    await updateOrderStatus(orderId, "PROCESSING");
    await sendOrderConfirmationOnly(billing, orderNumber, orderId, items, total, input.locale);
  } else {
    await updateOrderStatus(orderId, "COMPLETED");
    await triggerOrderEmails(billing, orderNumber, orderId, items, total, input.locale);
  }

  if (input.flashVariantMap?.size) {
    incrementFlashSaleSoldCounts(input.flashVariantMap, items).catch((err) => {
      logger.error({ err, orderNumber }, "Failed to increment flash sale sold counts (non-fatal)");
    });
  }

  if (input.affiliateRefCode) {
    createCommissionForOrder(input.affiliateRefCode, orderId, total).catch((err) => {
      logger.error({ err, orderNumber }, "Failed to create affiliate commission (non-fatal)");
    });
  }

  markCartRecovered(billing.email, orderId).catch((err) => {
    logger.error({ err, orderNumber }, "Failed to mark cart recovered (non-fatal)");
  });

  if (input.userId) {
    awardOrderPoints(input.userId, orderId, total).catch((err) => {
      logger.error({ err, orderNumber }, "Failed to award loyalty points (non-fatal)");
    });
  } else {
    const [eu] = await db.select({ id: users.id }).from(users)
      .where(eq(users.email, billing.email)).limit(1);
    if (eu) {
      awardOrderPoints(eu.id, orderId, total).catch((err) => {
        logger.error({ err, orderNumber }, "Failed to award loyalty points (non-fatal)");
      });
    }
  }

  scheduleTrustpilotInvite({ email: billing.email, name: `${billing.firstName} ${billing.lastName}`, orderNumber })
    .catch((err) => logger.error({ err, orderNumber }, "Trustpilot invite failed (non-fatal)"));
  recordPurchaseEvents(
    items.map((i) => ({ productId: i.productId, productName: i.productName, imageUrl: i.imageUrl ?? undefined })),
    `${billing.firstName}`, billing.city,
  ).catch((err) => logger.error({ err, orderNumber }, "Social proof record failed (non-fatal)"));

  logger.info({ orderNumber, total: total.toFixed(2) }, "Order fulfillment complete");
}

export async function executeOrderPipeline(input: OrderInput) {
  const { billing, items, orderNumber, total } = input;

  const cppAmount = input.cppSelected ? Math.round(input.subtotal * 0.05 * 100) / 100 : 0;
  const walletUsed = input.walletAmountUsd && input.walletAmountUsd > 0;
  const cardNeeded = walletUsed ? total - input.walletAmountUsd! > 0.01 : true;
  const payMethod = input.paymentMethod === "net30" ? "NET30" : walletUsed ? (cardNeeded ? "MIXED" : "WALLET") : "CARD";

  const [order] = await db
    .insert(orders)
    .values({
      orderNumber, guestEmail: billing.email, status: "PENDING",
      subtotalUsd: input.subtotal.toFixed(2), discountUsd: input.discountAmount.toFixed(2),
      totalUsd: total.toFixed(2), paymentMethod: payMethod,
      walletAmountUsed: walletUsed ? input.walletAmountUsd!.toFixed(2) : "0.00",
      userId: input.userId ?? null, cppSelected: input.cppSelected,
      cppAmountUsd: cppAmount.toFixed(2), taxRate: input.taxRate.toFixed(2),
      taxAmountUsd: input.taxAmount.toFixed(2), vatNumber: input.vatNumber,
    })
    .returning({ id: orders.id });

  let loyaltyRedeemed = false;
  let loyaltyAccountId: number | undefined;
  let walletDebited = false;
  try {
    if (input.loyaltyPointsUsed && input.loyaltyPointsUsed > 0 && input.userId) {
      const acct = await getOrCreateAccount(input.userId);
      loyaltyAccountId = acct.id;
      await redeemPoints(acct.id, input.loyaltyPointsUsed, order.id);
      loyaltyRedeemed = true;
    }

    await updateOrderStatus(order.id, "PROCESSING");
    if (input.walletAmountUsd && input.walletAmountUsd > 0 && input.userId) {
      await debitWallet(input.userId, input.walletAmountUsd, "PURCHASE",
        `Order ${orderNumber}`, `order:${order.id}`);
      walletDebited = true;
    }

    const cardAmount = input.walletAmountUsd
      ? Math.max(0, total - input.walletAmountUsd) : total;

    let paymentIntentId = "";
    if (cardAmount > 0.01 && input.cardToken) {
      const paymentResult = await processPayment({
        amount: cardAmount.toFixed(2),
        currency: "EUR",
        cardToken: input.cardToken,
        email: billing.email,
      });
      if (!paymentResult.success) {
        throw new Error(paymentResult.error ?? "Payment declined");
      }
      paymentIntentId = paymentResult.paymentIntentId;
    } else if (walletDebited) {
      paymentIntentId = `wallet_${Date.now()}`;
    }

    await runFulfillment(order.id, orderNumber, paymentIntentId, {
      billing,
      items,
      giftCards: input.giftCards,
      affiliateRefCode: input.affiliateRefCode,
      flashVariantMap: input.flashVariantMap,
      loyaltyPointsUsed: input.loyaltyPointsUsed,
      services: input.services,
      guestPassword: input.guestPassword,
      locale: input.locale,
      userId: input.userId,
    }, total);

    logger.info({ orderNumber, total: total.toFixed(2) }, "Order pipeline complete");
    return { orderNumber, status: "COMPLETED" };
  } catch (err) {
    if (walletDebited && input.userId && input.walletAmountUsd) {
      await creditWallet(input.userId, input.walletAmountUsd, "REFUND",
        `Reversed: order ${orderNumber} failed`, `reversal:${order.id}`).catch((wErr) => {
        logger.error({ wErr, orderNumber }, "Failed to restore wallet on order failure");
      });
    }
    if (loyaltyRedeemed && loyaltyAccountId && input.loyaltyPointsUsed) {
      await restorePoints(loyaltyAccountId, input.loyaltyPointsUsed,
        `Points restored: order ${orderNumber} failed`, order.id).catch((restoreErr) => {
        logger.error({ restoreErr, orderNumber }, "Failed to restore loyalty points on order failure");
      });
    }
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

async function fulfillFromMetenzi(orderId: number, items: OrderInput["items"], _insertedItems: { id: number; variantId: number }[]): Promise<boolean> {
  try {
    const config = await getMetenziConfig();
    if (!config) { logger.warn({ orderId }, "Metenzi not configured, skipping fulfillment"); return false; }

    // Resolve Metenzi product IDs from the mapping table (product-level mapping)
    const productIds = [...new Set(items.map((it) => it.productId).filter((id): id is number => !!id))];
    const mappings = productIds.length
      ? await db
          .select({ pixelProductId: metenziProductMappings.pixelProductId, metenziProductId: metenziProductMappings.metenziProductId })
          .from(metenziProductMappings)
          .where(and(inArray(metenziProductMappings.pixelProductId, productIds), isNotNull(metenziProductMappings.pixelProductId)))
      : [];
    const mappingByProductId = new Map(
      mappings.filter((m) => m.pixelProductId !== null).map((m) => [m.pixelProductId!, m.metenziProductId])
    );

    // Build resolved items: { metenziProductId, pixelProductId, quantity }
    // Needed for retry payload so retries also use Metenzi IDs, not Pixel variantIds
    const resolvedItems: { metenziProductId: string; pixelProductId: number; quantity: number }[] = [];
    for (const it of items) {
      const metenziId = mappingByProductId.get(it.productId);
      if (!metenziId) {
        logger.warn({ orderId, productId: it.productId }, "Item has no Metenzi mapping, skipping");
        continue;
      }
      resolvedItems.push({ metenziProductId: metenziId, pixelProductId: it.productId, quantity: it.quantity });
    }

    if (resolvedItems.length === 0) {
      logger.info({ orderId }, "No Metenzi-mapped items in order, skipping Metenzi fulfillment");
      return false;
    }

    const metenziItems = resolvedItems.map((it) => ({ variantId: it.metenziProductId, quantity: it.quantity }));
    const metenziOrder = await metenziCreateOrder(config, metenziItems);
    await db.update(orders).set({ externalOrderId: metenziOrder.id }).where(eq(orders.id, orderId));
    logger.info({ orderId, metenziOrderId: metenziOrder.id }, "Metenzi order placed, awaiting fulfillment webhook");
    return true;
  } catch (err) {
    const isCircuitOpen = err instanceof CircuitOpenError;
    logger.error({ err, orderId, circuitOpen: isCircuitOpen }, "Metenzi fulfillment failed");
    // Re-resolve for retry payload — we can't recover resolvedItems here so store productIds for retry
    const productIds2 = [...new Set(items.map((it) => it.productId).filter((id): id is number => !!id))];
    enqueueJob({
      queue: "order-processing",
      name: "metenzi-retry-fulfillment",
      priority: 3,
      maxAttempts: 5,
      payload: { orderId, productIds: productIds2 },
      scheduledAt: new Date(Date.now() + (isCircuitOpen ? 60_000 : 30_000)),
    }).catch((e) => logger.error({ e, orderId }, "Failed to enqueue fulfillment retry"));
    return false;
  }
}

async function createGuestAccount(billing: OrderInput["billing"], password: string) {
  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, billing.email)).limit(1);
    if (existing.length > 0) return;
    const hash = await bcrypt.hash(password, 12);
    await db.insert(users).values({ email: billing.email, passwordHash: hash, firstName: billing.firstName, lastName: billing.lastName, role: "CUSTOMER" });
    logger.info({ email: billing.email }, "Guest account created");
  } catch (err) { logger.error({ err }, "Failed to create guest account (non-fatal)"); }
}

async function createGuestAccountFromHash(billing: OrderInput["billing"], passwordHash: string) {
  try {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, billing.email)).limit(1);
    if (existing.length > 0) return;
    await db.insert(users).values({ email: billing.email, passwordHash, firstName: billing.firstName, lastName: billing.lastName, role: "CUSTOMER" });
    logger.info({ email: billing.email }, "Guest account created");
  } catch (err) { logger.error({ err }, "Failed to create guest account (non-fatal)"); }
}

async function incrementFlashSaleSoldCounts(flashVariantMap: Map<number, number>, items: OrderInput["items"]) {
  const qtyMap = new Map<string, { variantId: number; flashSaleId: number; qty: number }>();
  for (const item of items) {
    const fsId = flashVariantMap.get(item.variantId);
    if (fsId === undefined) continue;
    const key = `${fsId}-${item.variantId}`;
    const ex = qtyMap.get(key);
    if (ex) ex.qty += item.quantity;
    else qtyMap.set(key, { variantId: item.variantId, flashSaleId: fsId, qty: item.quantity });
  }
  for (const { variantId, flashSaleId, qty } of qtyMap.values()) {
    await db.update(flashSaleProducts).set({ soldCount: sql`LEAST(${flashSaleProducts.soldCount} + ${qty}, ${flashSaleProducts.maxQuantity})` })
      .where(and(eq(flashSaleProducts.variantId, variantId), eq(flashSaleProducts.flashSaleId, flashSaleId)));
  }
}
