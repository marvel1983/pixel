import { getProvidersCache } from "./providers-cache";

export interface TrackItem {
  id: string | number;
  name: string;
  category?: string;
  price: number;
  quantity?: number;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void; load: (id: string) => void; page: () => void };
    clarity?: (method: string, ...args: unknown[]) => void;
  }
}

function toGAItem(item: TrackItem) {
  return { item_id: String(item.id), item_name: item.name, item_category: item.category, price: item.price, quantity: item.quantity ?? 1 };
}

export function firePageView(path: string) {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "page_view", { page_path: path });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "PageView");
    if (p.type === "TIKTOK" && window.ttq) window.ttq.page();
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "page_view", page_path: path });
  }
}

export function fireViewItem(item: TrackItem, currency = "USD") {
  const cache = getProvidersCache();
  if (!cache) return;
  const gi = toGAItem(item);
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "view_item", { currency, value: item.price, items: [gi] });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "ViewContent", { content_ids: [String(item.id)], content_name: item.name, value: item.price, currency });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("ViewContent", { content_id: String(item.id), content_name: item.name, value: item.price, currency });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "view_item", ecommerce: { currency, value: item.price, items: [gi] } });
  }
}

export function fireViewItemList(items: TrackItem[], listName = "Product List", currency = "USD") {
  const cache = getProvidersCache();
  if (!cache) return;
  const gaItems = items.map((item, idx) => ({ ...toGAItem(item), index: idx, item_list_name: listName }));
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "view_item_list", { item_list_name: listName, items: gaItems });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "view_item_list", ecommerce: { item_list_name: listName, currency, items: gaItems } });
  }
}

export function firePurchase(orderId: string, value: number, currency = "USD", items: TrackItem[] = []) {
  const cache = getProvidersCache();
  if (!cache) return;
  const gaItems = items.map(toGAItem);
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "purchase", { transaction_id: orderId, value, currency, items: gaItems });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "Purchase", { value, currency, content_ids: items.map((i) => String(i.id)), num_items: items.length || 1 });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("CompletePayment", { value, currency, content_id: items.map((i) => String(i.id)).join(",") });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "purchase", ecommerce: { transaction_id: orderId, value, currency, items: gaItems } });
  }
}

export function fireAddToCart(value: number, currency = "USD", item?: TrackItem) {
  const cache = getProvidersCache();
  if (!cache) return;
  const gi = item ? [toGAItem(item)] : [];
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "add_to_cart", { value, currency, items: gi });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "AddToCart", { value, currency, content_ids: item ? [String(item.id)] : [], content_name: item?.name });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("AddToCart", { value, currency, content_id: item ? String(item.id) : undefined, content_name: item?.name });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "add_to_cart", ecommerce: { value, currency, items: gi } });
  }
}

export function fireRemoveFromCart(value: number, currency = "USD", item?: TrackItem) {
  const cache = getProvidersCache();
  if (!cache) return;
  const gi = item ? [toGAItem(item)] : [];
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "remove_from_cart", { value, currency, items: gi });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "remove_from_cart", ecommerce: { value, currency, items: gi } });
  }
}

export function fireViewCart(value: number, currency = "USD", items: TrackItem[] = []) {
  const cache = getProvidersCache();
  if (!cache) return;
  const gaItems = items.map(toGAItem);
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "view_cart", { value, currency, items: gaItems });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "view_cart", ecommerce: { value, currency, items: gaItems } });
  }
}

export function fireBeginCheckout(value: number, currency = "USD", items: TrackItem[] = []) {
  const cache = getProvidersCache();
  if (!cache) return;
  const gaItems = items.map(toGAItem);
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "begin_checkout", { value, currency, items: gaItems });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "InitiateCheckout", { value, currency, num_items: items.length || 1 });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("InitiateCheckout", { value, currency });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "begin_checkout", ecommerce: { value, currency, items: gaItems } });
  }
}

export function fireAddPaymentInfo(value: number, currency = "USD", paymentType = "card") {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "add_payment_info", { value, currency, payment_type: paymentType });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "AddPaymentInfo");
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "add_payment_info", ecommerce: { value, currency, payment_type: paymentType } });
  }
}

export function fireSearch(searchTerm: string, resultCount?: number) {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "search", { search_term: searchTerm });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "Search", { search_string: searchTerm });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("Search", { query: searchTerm });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "search", search_term: searchTerm, result_count: resultCount });
  }
}

export function fireSignUp(method = "email") {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "sign_up", { method });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "CompleteRegistration", { status: true });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("CompleteRegistration");
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "sign_up", method });
  }
}

export function fireLogin(method = "email") {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "login", { method });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "login", method });
  }
}

export function fireAddToWishlist(value: number, currency = "USD", item?: TrackItem) {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "GA4" && window.gtag) window.gtag("event", "add_to_wishlist", { value, currency, items: item ? [toGAItem(item)] : [] });
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "AddToWishlist", { value, currency, content_ids: item ? [String(item.id)] : [], content_name: item?.name });
    if (p.type === "TIKTOK" && window.ttq) window.ttq.track("AddToWishlist", { value, currency, content_id: item ? String(item.id) : undefined });
  }
}

export function fireLead(source = "newsletter") {
  const cache = getProvidersCache();
  if (!cache) return;
  for (const p of cache) {
    if (p.type === "META_PIXEL" && window.fbq) window.fbq("track", "Lead", { content_name: source });
    if (p.type === "GTM" && window.dataLayer) window.dataLayer.push({ event: "generate_lead", source });
  }
}

export function identifyUser(userId: string | number) {
  if (window.clarity) window.clarity("set", "userId", String(userId));
  if (window.gtag) window.gtag("set", { user_id: String(userId) });
  if (window.dataLayer) window.dataLayer.push({ user_id: String(userId) });
}
