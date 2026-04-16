import {
  metenziRequest,
  type MetenziClientConfig,
} from "./metenzi-client";

export interface MetenziProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string;
  shortDescription: string;
  platform: string;
  b2bPrice: string;
  b2bPriceCents: number;
  retailPrice: string;
  retailPriceCents: number;
  currency: string;
  stock: number;
  status: string;
  isKeyManaged: boolean;
  textKeyStock: number;
  imageKeyStock: number;
  imageUrl: string | null;
  warrantyDays: number;
  instructions: string | null;
  updatedAt: string;
}

export interface MetenziCatalogResponse {
  products: MetenziProduct[];
  total: number;
  limit: number;
  offset: number;
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
  const res = await metenziRequest<{ data: MetenziProduct[]; products?: MetenziProduct[] }>(config, {
    method: "GET",
    path: "/api/public/products",
    query: { retrieveAll: "true" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Metenzi products: ${res.status}`);
  }
  return res.data.data ?? res.data.products ?? [];
}

export interface CatalogFilters {
  search?: string;
  category?: string;
  platform?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getCatalogPage(
  config: MetenziClientConfig,
  filters: CatalogFilters = {},
): Promise<MetenziCatalogResponse> {
  const limit = filters.limit ?? 20;
  const page = filters.page ?? 1;
  const offset = (page - 1) * limit;

  const query: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
  };
  if (filters.search)   query.search   = filters.search;
  if (filters.category) query.category = filters.category;
  if (filters.platform) query.platform = filters.platform;
  if (filters.status)   query.status   = filters.status;

  const res = await metenziRequest<{
    success: boolean;
    data: MetenziProduct[];
    products?: MetenziProduct[];
    total: number;
    limit: number;
    offset: number;
  }>(config, {
    method: "GET",
    path: "/api/public/products",
    query,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Metenzi catalog: ${res.status}`);
  }

  const items = res.data.data ?? res.data.products ?? [];
  return {
    products: items,
    total: res.data.total ?? items.length,
    limit: res.data.limit ?? limit,
    offset: res.data.offset ?? offset,
  };
}

export async function getProductById(
  config: MetenziClientConfig,
  productId: string,
): Promise<MetenziProduct | null> {
  const res = await metenziRequest<{ product: MetenziProduct }>(config, {
    method: "GET",
    path: `/api/products/${productId}`,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch Metenzi product ${productId}: ${res.status}`);
  }
  return res.data.product;
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
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch Metenzi order ${orderId}: ${res.status}`);
  }
  return res.data.order;
}

export async function getBalance(
  config: MetenziClientConfig,
): Promise<MetenziBalance> {
  const res = await metenziRequest<MetenziBalance>(config, {
    method: "GET",
    path: "/api/balance",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Metenzi balance: ${res.status}`);
  }
  return res.data;
}

export async function listWebhooks(
  config: MetenziClientConfig,
): Promise<MetenziWebhook[]> {
  const res = await metenziRequest<{ webhooks: MetenziWebhook[] }>(config, {
    method: "GET",
    path: "/api/webhooks",
  });
  if (!res.ok) {
    throw new Error(`Failed to list Metenzi webhooks: ${res.status}`);
  }
  return res.data.webhooks ?? [];
}

export async function listClaims(
  config: MetenziClientConfig,
): Promise<MetenziClaim[]> {
  const res = await metenziRequest<{ claims: MetenziClaim[] }>(config, {
    method: "GET",
    path: "/api/claims",
  });
  if (!res.ok) {
    throw new Error(`Failed to list Metenzi claims: ${res.status}`);
  }
  return res.data.claims ?? [];
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
