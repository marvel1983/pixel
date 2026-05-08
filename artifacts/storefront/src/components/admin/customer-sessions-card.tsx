import { useEffect, useState } from "react";
import { Smartphone, Monitor, Tablet, Globe, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/admin/order-detail-ui";

interface SessionRow {
  id: string;
  ipAddress: string | null;
  deviceType: string | null;
  geoCountry: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  startedAt: string;
  lastSeenAt: string;
  eventCount: number;
  order: { id: number; orderNumber: string } | null;
}

function deviceIcon(type: string | null) {
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return Tablet;
  return Monitor;
}

function sourceLabel(s: SessionRow): string {
  if (s.utmSource) return `${s.utmSource}${s.utmMedium ? ` / ${s.utmMedium}` : ""}`;
  if (s.referrer) {
    try { return new URL(s.referrer).hostname.replace(/^www\./, ""); } catch { return s.referrer; }
  }
  return "Direct";
}

export function CustomerSessionsCard({ customerId, token }: { customerId: number; token: string | null }) {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const API = import.meta.env.VITE_API_URL ?? "/api";
    fetch(`${API}/admin/customers/${customerId}/sessions`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setRows(d.sessions ?? []))
      .catch(() => setRows([])).finally(() => setLoading(false));
  }, [customerId, token]);

  if (loading) return <Card title="Sessions"><p className="text-[12px] text-[#5a6a84]">Loading…</p></Card>;
  if (!rows || rows.length === 0) {
    return <Card title="Sessions"><p className="text-[12px] text-[#5a6a84]">No tracked sessions for this customer yet.</p></Card>;
  }

  return (
    <Card title="Sessions">
      <div className="overflow-x-auto rounded border border-[#2e3340]">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-[#1e2128]">
              {["Session", "Device", "Source", "Events", "Started", "Order"].map((h) => (
                <th key={h} className="border-b border-[#2a2e3a] px-3 py-[7px] text-left text-[10.5px] font-bold uppercase tracking-widest text-white">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, idx) => {
              const DeviceIcon = deviceIcon(s.deviceType);
              return (
                <tr key={s.id} className={idx % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"}>
                  <td className="border-b border-[#1f2840] px-3 py-2 font-mono text-[11px] text-[#5b9fd4]">{s.id.slice(0, 8)}…</td>
                  <td className="border-b border-[#1f2840] px-3 py-2 text-[#dde4f0]">
                    <span className="inline-flex items-center gap-1.5">
                      <DeviceIcon className="h-3.5 w-3.5 text-[#8fa0bb]" />
                      {s.deviceType ?? "—"}
                      {s.geoCountry && <span className="ml-2 inline-flex items-center gap-1 text-[10.5px] text-[#8fa0bb]"><Globe className="h-3 w-3" />{s.geoCountry}</span>}
                    </span>
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2 text-[#dde4f0]">
                    {sourceLabel(s)}
                    {s.utmCampaign && <div className="text-[10.5px] text-[#8fa0bb]">{s.utmCampaign}</div>}
                  </td>
                  <td className="border-b border-[#1f2840] px-3 py-2 text-center font-mono tabular-nums text-[#dde4f0]">{s.eventCount}</td>
                  <td className="border-b border-[#1f2840] px-3 py-2 text-[#a8b3c8] text-[11px]">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="border-b border-[#1f2840] px-3 py-2">
                    {s.order ? (
                      <Link to={`/admin/orders/${s.order.id}`}>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#5b9fd4] hover:underline cursor-pointer">
                          {s.order.orderNumber} <ExternalLink className="h-3 w-3" />
                        </span>
                      </Link>
                    ) : (
                      <span className="text-[11px] text-[#5a6a84]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
