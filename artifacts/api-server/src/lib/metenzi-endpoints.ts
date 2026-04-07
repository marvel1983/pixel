import {
  metenziRequest,
  type MetenziClientConfig,
} from "./metenzi-client";

export interface MetenziProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  type: string;
  category: string;
  imageUrl: string;
  galleryImages: string[];
  variants: MetenziVariant[];
  isActive: boolean;
}

export interface MetenziVariant {
  id: string;
  name: string;
  sku: string;
  platform: string;
  priceUsd: number;
  compareAtPriceUsd: number | null;
  stockCount: number;
}

export interface MetenziOrder {
  id: string;
  status: string;
  items: MetenziOrderItem[];
  totalUsd: number;
  createdAt: string;
}

export interface MetenziOrderItem {
  variantId: string;
  quantity: number;
  priceUsd: number;
}

export interface MetenziBalance {
  balanceUsd: number;
  currency: string;
}

export interface MetenziWebhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
}

export interface MetenziClaim {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  createdAt: string;
}

export async function getProducts(
  config: MetenziClientConfig,
): Promise<MetenziProduct[]> {
  const res = await metenziRequest<{ products: MetenziProduct[] }>(config, {
    method: "GET",
    path: "/api/products",
  });
  return res.data.products ?? [];
}

export async function getProductById(
  config: MetenziClientConfig,
  productId: string,
): Promise<MetenziProduct | null> {
  const res = await metenziRequest<{ product: MetenziProduct }>(config, {
    method: "GET",
    path: `/api/products/${productId}`,
  });
  return res.ok ? res.data.product : null;
}

export async function createOrder(
  config: MetenziClientConfig,
  items: { variantId: string; quantity: number }[],
): Promise<MetenziOrder> {
  const res = await metenziRequest<{ order: MetenziOrder }>(config, {
    method: "POST",
    path: "/api/orders",
    body: { items },
  });
  if (!res.ok) {
    throw new Error(`Failed to create Metenzi order: ${res.status}`);
  }
  return res.data.order;
}

export async function getOrderById(
  config: MetenziClientConfig,
  orderId: string,
): Promise<MetenziOrder | null> {
  const res = await metenziRequest<{ order: MetenziOrder }>(config, {
    method: "GET",
    path: `/api/orders/${orderId}`,
  });
  return res.ok ? res.data.order : null;
}

export async function getBalance(
  config: MetenziClientConfig,
): Promise<MetenziBalance> {
  const res = await metenziRequest<MetenziBalance>(config, {
    method: "GET",
    path: "/api/balance",
  });
  return res.data;
}

export async function listWebhooks(
  config: MetenziClientConfig,
): Promise<MetenziWebhook[]> {
  const res = await metenziRequest<{ webhooks: MetenziWebhook[] }>(config, {
    method: "GET",
    path: "/api/webhooks",
  });
  return res.data.webhooks ?? [];
}

export async function createWebhook(
  config: MetenziClientConfig,
  url: string,
  events: string[],
): Promise<MetenziWebhook> {
  const res = await metenziRequest<{ webhook: MetenziWebhook }>(config, {
    method: "POST",
    path: "/api/webhooks",
    body: { url, events },
  });
  if (!res.ok) {
    throw new Error(`Failed to create webhook: ${res.status}`);
  }
  return res.data.webhook;
}

export async function deleteWebhook(
  config: MetenziClientConfig,
  webhookId: string,
): Promise<boolean> {
  const res = await metenziRequest(config, {
    method: "DELETE",
    path: `/api/webhooks/${webhookId}`,
  });
  return res.ok;
}

export async function listClaims(
  config: MetenziClientConfig,
): Promise<MetenziClaim[]> {
  const res = await metenziRequest<{ claims: MetenziClaim[] }>(config, {
    method: "GET",
    path: "/api/claims",
  });
  return res.data.claims ?? [];
}

export async function submitClaim(
  config: MetenziClientConfig,
  orderId: string,
  reason: string,
): Promise<MetenziClaim> {
  const res = await metenziRequest<{ claim: MetenziClaim }>(config, {
    method: "POST",
    path: "/api/claims",
    body: { orderId, reason },
  });
  if (!res.ok) {
    throw new Error(`Failed to submit claim: ${res.status}`);
  }
  return res.data.claim;
}
