import { useEffect, useMemo, useState } from "react";
import { Smartphone, Monitor, Tablet, Globe, Clock, Hash } from "lucide-react";
import { Card } from "@/components/admin/order-detail-ui";
import {
  PHASE_COLOR, PHASE_LABEL, getPhase,
  type JourneyResponse, type JourneyEvent, type Phase,
} from "./customer-journey-types";
import { CustomerJourneyTimeline } from "./customer-journey-timeline";
import { CustomerJourneyDetail } from "./customer-journey-detail";

function deviceIcon(type: string | null) {
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return Tablet;
  return Monitor;
}

function fmtDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

const PHASE_ORDER: Phase[] = ["browse", "cart", "checkout", "form", "payment", "error", "success", "exit"];

function PhaseSummary({ events }: { events: JourneyEvent[] }) {
  const counts = useMemo(() => {
    const m = new Map<Phase, number>();
    for (const e of events) {
      const p = getPhase(e.eventType);
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  }, [events]);

  const visible = PHASE_ORDER.filter((p) => (counts.get(p) ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
      {visible.map((phase) => {
        const c = PHASE_COLOR[phase];
        const n = counts.get(phase) ?? 0;
        return (
          <div key={phase} className={`rounded border ${c.ring.replace("ring-", "border-")} ${c.bg} px-2 py-1.5`}>
            <p className={`text-[9.5px] font-bold uppercase tracking-wider ${c.text}`}>{PHASE_LABEL[phase]}</p>
            <p className="mt-0.5 font-mono tabular-nums text-[16px] font-bold text-white leading-none">{n}</p>
          </div>
        );
      })}
    </div>
  );
}

interface SessionHeaderProps { data: JourneyResponse }
function SessionHeader({ data }: SessionHeaderProps) {
  const s = data.session!;
  const DeviceIcon = deviceIcon(s.deviceType);
  const source = s.utmSource
    ? `${s.utmSource}${s.utmMedium ? ` / ${s.utmMedium}` : ""}`
    : (s.referrer ? (() => { try { return new URL(s.referrer!).hostname.replace(/^www\./, ""); } catch { return s.referrer; } })() : "Direct");
  const duration = fmtDuration(s.startedAt, s.lastSeenAt);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-[#8fa0bb] pb-3 border-b border-[#1f2840]">
      <span className="flex items-center gap-1.5"><Hash className="h-3 w-3" /><span className="font-mono text-[#5b9fd4]">{s.id.slice(0, 8)}…</span></span>
      <span className="flex items-center gap-1.5"><DeviceIcon className="h-3 w-3" /><span className="text-[#dde4f0]">{s.deviceType ?? "unknown"}</span></span>
      {s.geoCountry && <span className="flex items-center gap-1.5"><Globe className="h-3 w-3" />{s.geoCountry}</span>}
      <span>Source: <span className="text-[#dde4f0]">{source}</span></span>
      {s.utmCampaign && <span>Campaign: <span className="text-[#dde4f0]">{s.utmCampaign}</span></span>}
      <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{new Date(s.startedAt).toLocaleString()}</span>
      <span>Duration: <span className="text-[#dde4f0]">{duration}</span></span>
      <span>Events: <span className="text-[#dde4f0] font-mono">{data.events.length}</span></span>
    </div>
  );
}

interface Props { orderId: number; token: string | null }

export function CustomerJourneyCard({ orderId, token }: Props) {
  const [data, setData] = useState<JourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const API = import.meta.env.VITE_API_URL ?? "/api";
    fetch(`${API}/admin/orders/${orderId}/journey`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: JourneyResponse) => {
        setData(d);
        // Auto-select the most relevant event: order_created if present, else last event
        const orderCreated = d.events?.find((e) => e.eventType === "order_created");
        if (orderCreated) setSelectedEventId(orderCreated.id);
        else if (d.events?.length) setSelectedEventId(d.events[d.events.length - 1].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, token]);

  if (loading) return <Card title="Customer Journey"><p className="text-[12px] text-[#5a6a84]">Loading…</p></Card>;
  if (!data) return null;

  if (!data.session) {
    return <Card title="Customer Journey"><p className="text-[12px] text-[#5a6a84]">{data.message ?? "No session linked."}</p></Card>;
  }

  const selectedEvent = data.events.find((e) => e.id === selectedEventId) ?? null;

  return (
    <Card title="Customer Journey">
      <div className="space-y-3">
        <SessionHeader data={data} />
        <PhaseSummary events={data.events} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
            <CustomerJourneyTimeline
              events={data.events}
              snapshots={data.snapshots}
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </div>
          <div className="lg:sticky lg:top-2 lg:self-start">
            <CustomerJourneyDetail
              selectedEvent={selectedEvent}
              snapshots={data.snapshots}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
