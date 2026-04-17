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

export interface MetenziKeyItem {
  code: string;
  codeType?: string;
  status?: string;
  productId: string;
}

export interface MetenziOrder {
  id: string;
  status: string;
  items: MetenziOrderItem[];
  keys?: MetenziKeyItem[]; // Keys at order level, present when status = "paid"
  totalUsd?: number;
  total?: string;
  createdAt: string;
}

export interface MetenziOrderItem {
  variantId: string;
  quantity: number;
  priceUsd: number;
  keys?: string[];
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
  signingSecret?: string; // returned only on creation, save immediately
  secret?: string;        // alternate key name Metenzi may use
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
  const res = await metenziRequest<Record<string, unknown>>(config, {
    method: "POST",
    path: "/api/public/orders",
    body: { items },
  });
  if (!res.ok) {
    const detail = typeof res.data === "object" && res.data !== null
      ? JSON.stringify(res.data).slice(0, 200)
      : String(res.data ?? "");
    throw new Error(`Failed to create Metenzi order: ${res.status} — ${detail}`);
  }
  // Metenzi wraps response: { success, data: { orderId, keys, status, ... } }
  // Note: creation response uses "orderId" (not "id"); GET response uses "id"
  const d = res.data;
  const inner = (d.data ?? d.order ?? (d.orderId || d.id ? d : undefined)) as Record<string, unknown> | undefined;
  if (!inner) {
    throw new Error(`Metenzi createOrder: unexpected response shape. Raw: ${JSON.stringify(d).slice(0, 200)}`);
  }
  const order: MetenziOrder = {
    id: (inner.orderId ?? inner.id) as string,
    status: (inner.status ?? "") as string,
    items: (inner.items ?? []) as MetenziOrderItem[],
    keys: inner.keys as MetenziKeyItem[] | undefined,
    total: inner.total as string | undefined,
    createdAt: (inner.createdAt ?? "") as string,
  };
  if (!order.id) {
    throw new Error(`Metenzi createOrder: no order id in response. Raw: ${JSON.stringify(d).slice(0, 200)}`);
  }
  return order;
}

export async function getOrderById(
  config: MetenziClientConfig,
  orderId: string,
): Promise<MetenziOrder | null> {
  // /api/public/orders/:id returns keys when status = "paid"
  const res = await metenziRequest<Record<string, unknown>>(config, {
    method: "GET",
    path: `/api/public/orders/${orderId}`,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch Metenzi order ${orderId}: ${res.status}`);
  }
  const d = res.data;
  return (d.order ?? d.data ?? (d.id ? d : null)) as MetenziOrder | null;
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
  const res = await metenziRequest<{ webhooks?: MetenziWebhook[]; data?: MetenziWebhook[] } | MetenziWebhook[]>(config, {
    method: "GET",
    path: "/api/public/webhooks",
  });
  if (!res.ok) {
    throw new Error(`Failed to list Metenzi webhooks: ${res.status}`);
  }
  if (Array.isArray(res.data)) return res.data;
  return (res.data as { webhooks?: MetenziWebhook[]; data?: MetenziWebhook[] }).webhooks
    ?? (res.data as { webhooks?: MetenziWebhook[]; data?: MetenziWebhook[] }).data
    ?? [];
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
  const res = await metenziRequest<Record<string, unknown>>(config, {
    method: "POST",
    path: "/api/public/webhooks",
    body: { url, events },
  });
  if (!res.ok) {
    throw new Error(`Failed to create webhook: ${res.status}`);
  }
  // Metenzi may return { webhook: {...} }, { data: {...} }, or the object directly
  const d = res.data;
  const wh = (d.webhook ?? d.data ?? (d.id ? d : undefined)) as MetenziWebhook | undefined;
  if (!wh?.id) {
    // Webhook was likely created — return a stub so callers don't crash
    return { id: String(d.id ?? "unknown"), url, events, isActive: true } as MetenziWebhook;
  }
  // Capture signing secret if present at any level of the response
  const secret = (wh.signingSecret ?? wh.secret ?? (d as Record<string, unknown>).signingSecret ?? (d as Record<string, unknown>).secret) as string | undefined;
  return { ...wh, signingSecret: secret };
}

export async function deleteWebhook(
  config: MetenziClientConfig,
  webhookId: string,
): Promise<boolean> {
  const res = await metenziRequest(config, {
    method: "DELETE",
    path: `/api/public/webhooks/${webhookId}`,
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
