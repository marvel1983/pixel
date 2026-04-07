import { db } from "@workspace/db";
import { socialProofEvents } from "@workspace/db/schema";

interface PurchaseEventParams {
  productId: number;
  productName: string;
  productImageUrl?: string;
  customerName: string;
  customerCity?: string;
}

export async function recordPurchaseEvent(params: PurchaseEventParams) {
  await db.insert(socialProofEvents).values({
    productId: params.productId,
    eventType: "PURCHASE",
    productName: params.productName,
    productImageUrl: params.productImageUrl || null,
    customerName: params.customerName,
    customerCity: params.customerCity || null,
  });
}

export async function recordPurchaseEvents(
  items: Array<{ productId: number; productName: string; imageUrl?: string }>,
  customerName: string,
  customerCity?: string,
) {
  if (!items.length) return;
  await db.insert(socialProofEvents).values(
    items.map((item) => ({
      productId: item.productId,
      eventType: "PURCHASE" as const,
      productName: item.productName,
      productImageUrl: item.imageUrl || null,
      customerName,
      customerCity: customerCity || null,
    })),
  );
}
