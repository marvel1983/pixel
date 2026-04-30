import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface WebhookEvent {
  id: number;
  eventType: string;
  metenziOrderId: string | null;
  relatedOrderId: number | null;
  receivedAt: string;
  processedAt: string | null;
  success: boolean | null;
  outcomeNote: string | null;
  errorMsg: string | null;
  orderNumber: string | null;
}

type StatusFilter = "" | "true" | "false" | "pending";

function statusLabel(e: WebhookEvent): { text: string; cls: string } {
  if (e.processedAt == null) return { text: "PENDING", cls: "border-amber-500/50 bg-amber-500/10 text-amber-300" };
  if (e.success === true) return { text: "OK", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" };
  return { text: "ERROR", cls: "border-rose-500/50 bg-rose-500/10 text-rose-300" };
}

export default function MetenziWebhooksPage() {
  const token = useAuthStore((s) => s.token);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [eventType, setEventType] = useState("");
  const [success, setSuccess] = useState<StatusFilter>("");
  const [metenziOrderId, setMetenziOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, unknown>>({});

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (eventType) params.set("eventType", eventType);
    if (success) params.set("success", success);
    if (metenziOrderId) params.set("metenziOrderId", metenziOrderId);
    fetch(`${API}/admin/metenzi/webhook-events?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setEvents(d.events ?? []); setTotalPages(d.totalPages ?? 1); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, eventType, success, metenziOrderId, token]);

  const loadDetail = async (id: number) => {
    if (expanded[id]) { setExpanded((e) => ({ ...e, [id]: undefined })); return; }
    const r = await fetch(`${API}/admin/metenzi/webhook-events/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    setExpanded((e) => ({ ...e, [id]: d }));
  };

  return (
    <div className="space-y-4 text-[#dde4f0]">
      <h1 className="font-mono text-xl font-bold text-white tracking-tight">Metenzi Webhook Events</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={success} onChange={(e) => { setSuccess(e.target.value as StatusFilter); setPage(1); }}
          className="rounded border border-[#1e3a5f] bg-[#0a1828] px-2.5 py-1.5 text-[12.5px]">
          <option value="">All statuses</option>
          <option value="true">OK only</option>
          <option value="false">Errors only</option>
          <option value="pending">Pending only</option>
        </select>
        <input value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }}
          placeholder="Event type (e.g. order.fulfilled)"
          className="rounded border border-[#1e3a5f] bg-[#0a1828] px-2.5 py-1.5 text-[12.5px] w-[230px]" />
        <input value={metenziOrderId} onChange={(e) => { setMetenziOrderId(e.target.value); setPage(1); }}
          placeholder="Metenzi order ID"
          className="rounded border border-[#1e3a5f] bg-[#0a1828] px-2.5 py-1.5 text-[12.5px] font-mono w-[280px]" />
      </div>
      {loading ? <Skeleton className="h-64 bg-[#1a2235]" /> : (
        <div className="rounded border border-[#2e3340] overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-[#1e2128]">
                {["Received", "Event", "Metenzi order", "Local order", "Status", "Note", ""].map((h) => (
                  <th key={h} className="border-b border-[#2a2e3a] px-3 py-[8px] text-left text-[10.5px] font-bold uppercase tracking-widest text-white">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e, idx) => {
                const s = statusLabel(e);
                const detail = expanded[e.id];
                return (
                  <>
                    <tr key={e.id} className={idx % 2 === 0 ? "bg-[#0c1018]" : "bg-[#0f1520]"}>
                      <td className="border-b border-[#1f2840] px-3 py-2 font-mono text-[11.5px] text-[#8fa0bb]">{new Date(e.receivedAt).toLocaleString()}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2 font-mono">{e.eventType}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2 font-mono text-[11.5px] text-[#8fa0bb]">{e.metenziOrderId ?? "—"}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2">
                        {e.orderNumber ? <Link to={`/admin/orders/${e.relatedOrderId}`} className="text-sky-300 hover:underline font-mono">{e.orderNumber}</Link> : <span className="text-[#5a6a84]">—</span>}
                      </td>
                      <td className="border-b border-[#1f2840] px-3 py-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.text}</span>
                      </td>
                      <td className="border-b border-[#1f2840] px-3 py-2 text-[11.5px] text-[#8fa0bb]">{e.errorMsg ? <span className="text-rose-300">{e.errorMsg.slice(0, 80)}</span> : (e.outcomeNote ?? "—")}</td>
                      <td className="border-b border-[#1f2840] px-3 py-2">
                        <button onClick={() => loadDetail(e.id)} className="rounded border border-sky-500/40 bg-sky-600/15 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-600/25">{detail ? "Hide" : "JSON"}</button>
                      </td>
                    </tr>
                    {detail != null ? (
                      <tr key={`${e.id}-d`} className="bg-[#06080d]">
                        <td colSpan={7} className="border-b border-[#1f2840] px-3 py-2">
                          <pre className="font-mono text-[11px] text-[#a8d4f5] whitespace-pre-wrap break-all max-h-[420px] overflow-y-auto">{JSON.stringify(detail, null, 2)}</pre>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
              {events.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-[#5a6a84]">No events match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded border border-[#2e3340] bg-[#1a2235] px-3 py-1.5 text-[12px] text-[#8fa0bb] disabled:opacity-40">Prev</button>
        <span className="text-[12px] text-[#8fa0bb]">Page {page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
          className="rounded border border-[#2e3340] bg-[#1a2235] px-3 py-1.5 text-[12px] text-[#8fa0bb] disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
