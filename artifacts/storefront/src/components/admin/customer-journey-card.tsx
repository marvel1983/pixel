import { useEffect, useState } from "react";
import {
  Eye, ShoppingCart, CreditCard, Edit3, AlertTriangle,
  CheckCircle, LogOut, Camera, Globe, Smartphone, Monitor, Tablet,
} from "lucide-react";
import { Card } from "@/components/admin/order-detail-ui";

interface SessionSummary {
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

interface JourneyEvent {
  id: number;
  eventType: string;
  pagePath: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

interface JourneySnapshot {
  id: number;
  triggerEvent: string;
  items: Array<{ productName: string; variantName: string; quantity: number; priceUsd: string }>;
  totals: { subtotalUsd: string; totalUsd: string; currency: string; couponCode?: string };
  capturedAt: string;
}

interface JourneyResponse {
  session: SessionSummary | null;
  events: JourneyEvent[];
  snapshots: JourneySnapshot[];
  message?: string;
}

const KIND_FOR_EVENT: Record<string, string> = {
  page_view: "view", product_view: "view",
  add_to_cart: "cart", remove_from_cart: "cart", update_cart_qty: "cart", apply_coupon: "cart",
  enter_checkout: "checkout", checkout_step: "checkout",
  form_field_focus: "form", form_field_blur: "form", form_validation_error: "form",
  payment_method_selected: "payment", place_order_clicked: "payment", stripe_redirect: "payment",
  stripe_error: "error", js_error: "error", order_failed: "error",
  order_created: "success",
  page_unload: "exit",
  custom_click: "view",
};

const KIND_STYLE: Record<string, { ring: string; bg: string; iconColor: string; Icon: typeof Eye }> = {
  view:     { ring: "border-sky-500/40",     bg: "bg-sky-500/10",     iconColor: "text-sky-400",     Icon: Eye },
  cart:     { ring: "border-emerald-500/40", bg: "bg-emerald-500/10", iconColor: "text-emerald-400", Icon: ShoppingCart },
  checkout: { ring: "border-cyan-500/40",    bg: "bg-cyan-500/10",    iconColor: "text-cyan-400",    Icon: CreditCard },
  form:     { ring: "border-amber-500/40",   bg: "bg-amber-500/10",   iconColor: "text-amber-400",   Icon: Edit3 },
  payment:  { ring: "border-violet-500/40",  bg: "bg-violet-500/10",  iconColor: "text-violet-400",  Icon: CreditCard },
  error:    { ring: "border-rose-500/40",    bg: "bg-rose-500/10",    iconColor: "text-rose-400",    Icon: AlertTriangle },
  success:  { ring: "border-emerald-500/40", bg: "bg-emerald-500/10", iconColor: "text-emerald-400", Icon: CheckCircle },
  exit:     { ring: "border-fuchsia-500/40", bg: "bg-fuchsia-500/10", iconColor: "text-fuchsia-400", Icon: LogOut },
  snapshot: { ring: "border-slate-500/40",   bg: "bg-slate-500/10",   iconColor: "text-slate-300",   Icon: Camera },
};

function deviceIcon(type: string | null) {
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return Tablet;
  return Monitor;
}

function eventLabel(e: JourneyEvent): string {
  const t = e.eventType;
  if (t === "checkout_step" && typeof (e.metadata as { step?: unknown })?.step === "string") {
    return `Checkout step: ${(e.metadata as { step: string }).step}`;
  }
  if (t === "payment_method_selected" && typeof (e.metadata as { method?: unknown })?.method === "string") {
    return `Payment method: ${(e.metadata as { method: string }).method}`;
  }
  return t.replace(/_/g, " ");
}

interface Row {
  kind: "event" | "snapshot";
  ts: number;
  event?: JourneyEvent;
  snapshot?: JourneySnapshot;
}

function mergeRows(events: JourneyEvent[], snapshots: JourneySnapshot[]): Row[] {
  const out: Row[] = [
    ...events.map((e) => ({ kind: "event" as const, ts: new Date(e.occurredAt).getTime(), event: e })),
    ...snapshots.map((s) => ({ kind: "snapshot" as const, ts: new Date(s.capturedAt).getTime(), snapshot: s })),
  ];
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

export function CustomerJourneyCard({ orderId, token }: { orderId: number; token: string | null }) {
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [openIdx, setOpenIdx] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!token) return;
    const API = import.meta.env.VITE_API_URL ?? "/api";
    fetch(`${API}/admin/orders/${orderId}/journey`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [orderId, token]);

  if (loading) return <Card title="Customer Journey"><p className="text-[12px] text-[#5a6a84]">Loading…</p></Card>;
  if (!data) return null;

  if (!data.session) {
    return <Card title="Customer Journey"><p className="text-[12px] text-[#5a6a84]">{data.message ?? "No session linked."}</p></Card>;
  }

  const s = data.session;
  const DeviceIcon = deviceIcon(s.deviceType);
  const rows = mergeRows(data.events, data.snapshots);
  const source = s.utmSource ? `${s.utmSource}${s.utmMedium ? ` / ${s.utmMedium}` : ""}` : (s.referrer || "Direct");

  return (
    <Card title="Customer Journey">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#8fa0bb] pb-3 border-b border-[#1f2840] mb-3">
        <span className="font-mono text-[#5b9fd4]">{s.id.slice(0, 8)}…</span>
        <span className="flex items-center gap-1"><DeviceIcon className="h-3 w-3" /> {s.deviceType ?? "unknown"}</span>
        {s.geoCountry && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {s.geoCountry}</span>}
        <span>Source: <span className="text-[#dde4f0]">{source}</span></span>
        {s.utmCampaign && <span>Campaign: <span className="text-[#dde4f0]">{s.utmCampaign}</span></span>}
        <span>Started: {new Date(s.startedAt).toLocaleString()}</span>
        <span>Events: {data.events.length}</span>
      </div>

      <div className="space-y-2.5">
        {rows.map((r, i) => {
          if (r.kind === "snapshot" && r.snapshot) {
            const sn = r.snapshot;
            const style = KIND_STYLE.snapshot;
            const { Icon } = style;
            return (
              <div key={`s${sn.id}`} className="flex items-start gap-3">
                <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border ${style.ring} ${style.bg} flex items-center justify-center`}>
                  <Icon className={`h-3 w-3 ${style.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] text-[#a8b3c8]">Cart snapshot · {sn.items.length} item(s) · {sn.totals.totalUsd} {sn.totals.currency}</p>
                  <p className="text-[11px] text-[#5a6a84]">trigger: {sn.triggerEvent} · {new Date(sn.capturedAt).toLocaleString()}</p>
                  <button onClick={() => setOpenIdx((o) => ({ ...o, [i]: !o[i] }))} className="mt-0.5 text-[10.5px] text-[#5b9fd4] hover:underline">
                    {openIdx[i] ? "Hide cart" : "Show cart"}
                  </button>
                  {openIdx[i] && (
                    <pre className="mt-1.5 rounded border border-[#2e3340] bg-[#0a0d12] px-2 py-1.5 font-mono text-[10.5px] text-[#a8d4f5] whitespace-pre-wrap break-all max-h-[180px] overflow-y-auto">
{JSON.stringify({ items: sn.items, totals: sn.totals }, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          }
          if (!r.event) return null;
          const ev = r.event;
          const kind = KIND_FOR_EVENT[ev.eventType] ?? "view";
          const style = KIND_STYLE[kind];
          const { Icon } = style;
          const hasMeta = ev.metadata && Object.keys(ev.metadata).length > 0;
          return (
            <div key={`e${ev.id}`} className="flex items-start gap-3">
              <div className={`mt-0.5 h-5 w-5 shrink-0 rounded-full border ${style.ring} ${style.bg} flex items-center justify-center`}>
                <Icon className={`h-3 w-3 ${style.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-[#dde4f0]">{eventLabel(ev)}</p>
                <p className="text-[11px] text-[#5a6a84]">
                  {ev.pagePath ? <span className="font-mono">{ev.pagePath}</span> : null}
                  {ev.pagePath ? " · " : ""}
                  {new Date(ev.occurredAt).toLocaleString()}
                </p>
                {hasMeta && (
                  <button onClick={() => setOpenIdx((o) => ({ ...o, [i]: !o[i] }))} className="mt-0.5 text-[10.5px] text-[#5b9fd4] hover:underline">
                    {openIdx[i] ? "Hide details" : "Show details"}
                  </button>
                )}
                {hasMeta && openIdx[i] && (
                  <pre className="mt-1.5 rounded border border-[#2e3340] bg-[#0a0d12] px-2 py-1.5 font-mono text-[10.5px] text-[#a8d4f5] whitespace-pre-wrap break-all max-h-[180px] overflow-y-auto">
{JSON.stringify(ev.metadata, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[12px] text-[#5a6a84]">No events recorded for this session.</p>}
      </div>
    </Card>
  );
}
