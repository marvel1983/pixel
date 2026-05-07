import { z } from "zod";

const s1 = z.string().min(1);

export const billingSchemaForPayload = z.object({
  email: z.string().email(), firstName: s1, lastName: s1,
  country: s1, city: z.string().default(""), address: z.string().default(""), zip: z.string().default(""),
  phone: z.string().trim().min(5).max(40),
});

export const itemSchemaForPayload = z.object({
  variantId: z.number().int(), productId: z.number().int(),
  productName: s1, variantName: s1, imageUrl: z.string().nullish(),
  priceUsd: z.string(), quantity: z.number().int().positive().max(99),
  platform: z.string().nullish(), bundleId: z.number().int().optional(),
});

export interface StripeFulfillmentPayload {
  billing: z.infer<typeof billingSchemaForPayload>;
  items: z.infer<typeof itemSchemaForPayload>[];
  giftCards: Array<{ code: string; amount: number }>;
  flashVariantMap: Array<[number, number]>;
  affiliateRefCode: string | undefined;
  loyaltyPointsUsed: number | undefined;
  loyaltyAccountId: number | undefined;
  services: Array<{ id: number; name: string; priceUsd: string }>;
  guestPasswordHash: string | undefined;
  locale: string | undefined;
  total: number;
  clientIp: string;
}

export interface ProcessingFeeTier { minAmount: number; feePercent: number; feeFixed: number }

export function applyProcessingFee(
  feeBase: number,
  tiers: ProcessingFeeTier[] | null | undefined,
  flatPercent: number,
  flatFixed: number,
): number {
  if (tiers && tiers.length > 0) {
    const sorted = [...tiers].sort((a, b) => b.minAmount - a.minAmount);
    const tier = sorted.find((t) => feeBase >= t.minAmount) ?? sorted[sorted.length - 1];
    return Math.round((feeBase * tier.feePercent / 100 + tier.feeFixed) * 100) / 100;
  }
  return Math.round((feeBase * flatPercent / 100 + flatFixed) * 100) / 100;
}

export function serializeFulfillmentPayload(payload: StripeFulfillmentPayload): string {
  return `__stripe_payload:${JSON.stringify(payload)}`;
}

export function parseFulfillmentPayload(notes: string | null): StripeFulfillmentPayload | null {
  if (!notes?.startsWith("__stripe_payload:")) return null;
  try {
    return JSON.parse(notes.slice("__stripe_payload:".length)) as StripeFulfillmentPayload;
  } catch {
    return null;
  }
}

export function isAllowedRedirectUrl(url: string): boolean {
  try {
    const { origin } = new URL(url);
    const storeUrl = process.env.STORE_PUBLIC_URL ?? process.env.APP_PUBLIC_URL;
    if (storeUrl) return origin === new URL(storeUrl).origin;
    // No store URL configured — only allow localhost (dev environments)
    return origin === "http://localhost:18539" || origin === "http://localhost:3000";
  } catch {
    return false;
  }
}

export const generateOrderNumber = () =>
  `PC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
