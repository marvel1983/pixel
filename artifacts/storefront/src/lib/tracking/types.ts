export type TrackingEventType =
  | "page_view"
  | "product_view"
  | "add_to_cart"
  | "remove_from_cart"
  | "update_cart_qty"
  | "apply_coupon"
  | "enter_checkout"
  | "checkout_step"
  | "form_field_focus"
  | "form_field_blur"
  | "form_validation_error"
  | "payment_method_selected"
  | "place_order_clicked"
  | "stripe_redirect"
  | "stripe_error"
  | "order_created"
  | "order_failed"
  | "page_unload"
  | "js_error"
  | "custom_click";

export interface TrackingEvent {
  eventType: TrackingEventType;
  occurredAt: string;
  pagePath?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CartSnapshotItemPayload {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  quantity: number;
  priceUsd: string;
  imageUrl?: string;
}

export interface CartSnapshotTotalsPayload {
  subtotalUsd: string;
  discountUsd: string;
  taxUsd: string;
  totalUsd: string;
  currency: string;
  couponCode?: string;
}

export interface CartSnapshotPayload {
  triggerEvent: string;
  capturedAt: string;
  items: CartSnapshotItemPayload[];
  totals: CartSnapshotTotalsPayload;
}

export interface SessionInitPayload {
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  deviceType?: "mobile" | "desktop" | "tablet" | null;
}

export interface TrackBatchBody {
  events: TrackingEvent[];
  snapshots?: CartSnapshotPayload[];
  sessionInit?: SessionInitPayload;
}
