import {
  Search, Eye, MousePointerClick,
  ShoppingCart, ShoppingBag, Tag,
  CreditCard, ListChecks, Wallet,
  Edit3, AlertTriangle,
  Send, ExternalLink,
  CheckCircle2, XCircle,
  LogOut, Bug, Camera,
  type LucideIcon,
} from "lucide-react";

export type Phase = "browse" | "cart" | "checkout" | "form" | "payment" | "success" | "error" | "exit";

export const PHASE_LABEL: Record<Phase, string> = {
  browse: "Browse",
  cart: "Cart",
  checkout: "Checkout",
  form: "Form",
  payment: "Payment",
  success: "Success",
  error: "Errors",
  exit: "Exit",
};

export const PHASE_COLOR: Record<Phase, { ring: string; bg: string; text: string; dot: string; glow: string }> = {
  browse:   { ring: "ring-sky-500/40",     bg: "bg-sky-500/10",     text: "text-sky-300",     dot: "bg-sky-500",     glow: "shadow-sky-500/20" },
  cart:     { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-300", dot: "bg-emerald-500", glow: "shadow-emerald-500/20" },
  checkout: { ring: "ring-cyan-500/40",    bg: "bg-cyan-500/10",    text: "text-cyan-300",    dot: "bg-cyan-500",    glow: "shadow-cyan-500/20" },
  form:     { ring: "ring-amber-500/40",   bg: "bg-amber-500/10",   text: "text-amber-300",   dot: "bg-amber-500",   glow: "shadow-amber-500/20" },
  payment:  { ring: "ring-violet-500/40",  bg: "bg-violet-500/10",  text: "text-violet-300",  dot: "bg-violet-500",  glow: "shadow-violet-500/20" },
  success:  { ring: "ring-emerald-400/60", bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400", glow: "shadow-emerald-400/40" },
  error:    { ring: "ring-rose-500/50",    bg: "bg-rose-500/10",    text: "text-rose-300",    dot: "bg-rose-500",    glow: "shadow-rose-500/30" },
  exit:     { ring: "ring-slate-500/40",   bg: "bg-slate-500/10",   text: "text-slate-300",   dot: "bg-slate-500",    glow: "shadow-slate-500/20" },
};

export const EVENT_TO_PHASE: Record<string, Phase> = {
  page_view: "browse",
  product_view: "browse",
  custom_click: "browse",
  add_to_cart: "cart",
  remove_from_cart: "cart",
  update_cart_qty: "cart",
  apply_coupon: "cart",
  enter_checkout: "checkout",
  checkout_step: "checkout",
  payment_method_selected: "checkout",
  form_field_focus: "form",
  form_field_blur: "form",
  form_validation_error: "error",
  place_order_clicked: "payment",
  stripe_redirect: "payment",
  stripe_error: "error",
  order_created: "success",
  order_failed: "error",
  page_unload: "exit",
  js_error: "error",
};

export const EVENT_ICON: Record<string, LucideIcon> = {
  page_view: Eye,
  product_view: Search,
  custom_click: MousePointerClick,
  add_to_cart: ShoppingCart,
  remove_from_cart: ShoppingBag,
  update_cart_qty: ShoppingCart,
  apply_coupon: Tag,
  enter_checkout: CreditCard,
  checkout_step: ListChecks,
  payment_method_selected: Wallet,
  form_field_focus: Edit3,
  form_field_blur: Edit3,
  form_validation_error: AlertTriangle,
  place_order_clicked: Send,
  stripe_redirect: ExternalLink,
  stripe_error: XCircle,
  order_created: CheckCircle2,
  order_failed: XCircle,
  page_unload: LogOut,
  js_error: Bug,
};

export function getPhase(eventType: string): Phase {
  return EVENT_TO_PHASE[eventType] ?? "browse";
}

export function eventLabel(eventType: string): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SNAPSHOT_ICON = Camera;

export interface SessionSummary {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  geoCountry: string | null;
  deviceType: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  startedAt: string;
  lastSeenAt: string;
}

export interface JourneyEvent {
  id: number;
  eventType: string;
  pagePath: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

export interface JourneySnapshotItem {
  productName: string;
  variantName: string;
  quantity: number;
  priceUsd: string;
  imageUrl?: string;
}

export interface JourneySnapshotTotals {
  subtotalUsd: string;
  discountUsd: string;
  taxUsd: string;
  totalUsd: string;
  currency: string;
  couponCode?: string;
}

export interface JourneySnapshot {
  id: number;
  triggerEvent: string;
  items: JourneySnapshotItem[];
  totals: JourneySnapshotTotals;
  capturedAt: string;
}

export interface JourneyResponse {
  session: SessionSummary | null;
  events: JourneyEvent[];
  snapshots: JourneySnapshot[];
  message?: string;
}

export function snapshotForEvent(
  event: JourneyEvent,
  snapshots: JourneySnapshot[],
): JourneySnapshot | null {
  const eventTime = new Date(event.occurredAt).getTime();
  let best: JourneySnapshot | null = null;
  let bestTime = -Infinity;
  for (const sn of snapshots) {
    const t = new Date(sn.capturedAt).getTime();
    if (t <= eventTime && t > bestTime) {
      bestTime = t;
      best = sn;
    }
  }
  return best;
}
