import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, RotateCcw, Activity, AlertTriangle, CheckCircle2, Clock, Server, Database, Mail, CreditCard, ShoppingBag } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface CircuitInfo {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
  lastSuccessAt: number | null;
  lastError: string | null;
}
interface ServiceHealth {
  name: string; status: "up" | "down"; latencyMs: number; lastChecked: string;
  error?: string; uptime: { h24: number; d7: number; d30: number };
}
interface Incident { service: string; status: string; error: string | null; at: string }
interface DetailedHealth {
  status: string; responseTimeMs: number; timestamp: string;
  services: ServiceHealth[]; incidents: Incident[];
}

const SVC_META: Record<string, { icon: typeof Database; label: string }> = {
  database: { icon: Database, label: "PostgreSQL Database" },
  smtp: { icon: Mail, label: "SMTP Mail Server" },
  metenzi: { icon: ShoppingBag, label: "Metenzi Supplier API" },
  payment: { icon: CreditCard, label: "Payment Gateway" },
};
const CIRCUIT_LABELS: Record<string, { label: string; desc: string }> = {
  metenzi: { label: "Metenzi (Supplier)", desc: "Product catalog and fulfillment" },
  checkout: { label: "Checkout.com (Payments)", desc: "Payment processing and refunds" },
  trustpilot: { label: "Trustpilot (Reviews)", desc: "Review invitation delivery" },
  mailchimp: { label: "Mailchimp (Newsletter)", desc: "Newsletter subscriber sync" },
};

function stateColor(s: string) {
  if (s === "CLOSED" || s === "up") return "bg-green-100 text-green-800";
  if (s === "OPEN" || s === "down") return "bg-red-100 text-red-800";
  return "bg-yellow-100 text-yellow-800";
}
function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />;
}
function formatTime(ts: number | string | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleString();
}
function uptimeBar(pct: number) {
  const color = pct >= 99.5 ? "bg-green-500" : pct >= 95 ? "bg-yellow-500" : "bg-red-500";
  return <div className="h-1.5 rounded bg-[#1e2128] w-full"><div className={`h-1.5 rounded ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>;
}

export default function SystemStatusPage() {
  const token = useAuthStore((s) => s.token);
  const [circuits, setCircuits] = useState<Record<string, CircuitInfo>>({});
  const [alerts, setAlerts] = useState<string[]>([]);
  const [health, setHealth] = useState<DetailedHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [tab, setTab] = useState<"health" | "circuits" | "incidents">("health");

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cRes, hRes] = await Promise.all([
        fetch(`${API}/admin/system-status/circuits`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/health/detailed`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cRes.ok) { const d = await cRes.json(); setCircuits(d.circuits); setAlerts(d.alerts ?? []); }
      const hBody = await hRes.json().catch(() => null);
      if (hBody) { setHealth(hBody); }
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const i = setInterval(fetchAll, 30_000); return () => clearInterval(i); }, [fetchAll]);

  const resetCircuit = async (name: string) => {
    if (!token) return;
    setResetting(name);
    try {
      await fetch(`${API}/admin/system-status/circuits/${name}/reset`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      await fetchAll();
    } catch {} finally { setResetting(null); }
  };

  const openCount = Object.values(circuits).filter((c) => c.state === "OPEN").length;
  const halfOpenCount = Object.values(circuits).filter((c) => c.state === "HALF_OPEN").length;
  const allCircuitsOk = openCount === 0 && halfOpenCount === 0;
  const healthDown = health?.services.some((s) => s.status === "down") ?? false;
  const overallOk = allCircuitsOk && !healthDown;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
          <p className="text-[#5a6a84] text-sm">Infrastructure and external service monitoring</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh
        </Button>
      </div>

      {!overallOk && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 space-y-1">
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" />
            <span className="font-medium text-red-300">
              {health?.status === "unhealthy" ? "System unhealthy" : health?.status === "degraded" ? "System degraded" : ""}
              {openCount > 0 && ` · ${openCount} circuit(s) open`}
            </span>
          </div>
          {alerts.map((a, i) => <p key={i} className="text-sm text-red-400 ml-7">{a}</p>)}
        </div>
      )}
      {overallOk && !loading && (
        <div className="rounded-lg border border-green-800 bg-green-950/40 p-4">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-400" />
            <span className="font-medium text-green-300">All systems operational</span>
            {health && <span className="text-xs text-green-500 ml-auto">{health.responseTimeMs}ms</span>}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-[#2a2e3a]">
        {(["health", "circuits", "incidents"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-sky-500 text-sky-400" : "border-transparent text-[#5a6a84] hover:text-[#dde4f0]"}`}>
            {t === "health" ? "Dependencies" : t === "circuits" ? "Circuit Breakers" : "Incident Log"}
          </button>
        ))}
      </div>

      {tab === "health" && health && (
        <div className="grid gap-4 md:grid-cols-2">
          {health.services.map((svc) => {
            const meta = SVC_META[svc.name] ?? { icon: Server, label: svc.name };
            const Icon = meta.icon;
            return (
              <DarkCard key={svc.name} title={meta.label}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${svc.status === "up" ? "text-green-400" : "text-red-400"}`} />
                    <div><p className="font-medium text-sm text-[#dde4f0]">{meta.label}</p><p className="text-xs text-[#5a6a84]">{svc.latencyMs}ms latency</p></div>
                  </div>
                  <Badge className={stateColor(svc.status)}>{svc.status.toUpperCase()}</Badge>
                </div>
                {svc.error && <p className="text-xs text-red-400 font-mono bg-red-950/40 rounded p-2 truncate">{svc.error}</p>}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-[#5a6a84]">24h uptime</span><span className="font-medium text-[#dde4f0]">{svc.uptime.h24}%</span></div>
                  {uptimeBar(svc.uptime.h24)}
                  <div className="flex justify-between text-xs"><span className="text-[#5a6a84]">7d uptime</span><span className="font-medium text-[#dde4f0]">{svc.uptime.d7}%</span></div>
                  {uptimeBar(svc.uptime.d7)}
                  <div className="flex justify-between text-xs"><span className="text-[#5a6a84]">30d uptime</span><span className="font-medium text-[#dde4f0]">{svc.uptime.d30}%</span></div>
                  {uptimeBar(svc.uptime.d30)}
                </div>
              </DarkCard>
            );
          })}
        </div>
      )}

      {tab === "circuits" && (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(circuits).map(([name, info]) => {
            const meta = CIRCUIT_LABELS[name] ?? { label: name, desc: "" };
            return (
              <DarkCard key={name} title={meta.label} description={meta.desc}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <StatusDot ok={info.state === "CLOSED"} />
                    <span className="text-[12px] text-[#5a6a84]">{meta.desc}</span>
                  </div>
                  <Badge className={stateColor(info.state)}>{info.state.replace("_", " ")}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-[#5a6a84]">Failures:</span> <span className="font-medium text-[#dde4f0]">{info.failures}</span></div>
                  <div><span className="text-[#5a6a84]">Last success:</span> <span className="font-medium text-xs text-[#dde4f0]">{formatTime(info.lastSuccessAt)}</span></div>
                  <div><span className="text-[#5a6a84]">Last failure:</span> <span className="font-medium text-xs text-[#dde4f0]">{formatTime(info.lastFailureAt)}</span></div>
                  <div><span className="text-[#5a6a84]">State since:</span> <span className="font-medium text-xs text-[#dde4f0]">{formatTime(info.lastStateChangeAt)}</span></div>
                </div>
                {info.lastError && <div className="rounded bg-[#0c1018] p-2"><p className="text-xs font-mono text-red-400 truncate">{info.lastError}</p></div>}
                {info.state !== "CLOSED" && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => resetCircuit(name)} disabled={resetting === name}>
                    <RotateCcw className={`mr-2 h-3 w-3 ${resetting === name ? "animate-spin" : ""}`} />Reset Circuit
                  </Button>
                )}
              </DarkCard>
            );
          })}
        </div>
      )}

      {tab === "incidents" && health && (
        <DarkCard title="Recent Status Changes">
          {health.incidents.length === 0 ? (
            <p className="text-center text-[#5a6a84] py-4">No recent incidents</p>
          ) : (
            <div className="divide-y divide-[#2a2e3a]">
              {health.incidents.map((inc, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <StatusDot ok={inc.status === "up"} />
                    <div>
                      <p className="text-sm font-medium text-[#dde4f0]">{SVC_META[inc.service]?.label ?? inc.service} went {inc.status.toUpperCase()}</p>
                      {inc.error && <p className="text-xs text-[#5a6a84] truncate max-w-xs">{inc.error}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-[#5a6a84] whitespace-nowrap">{formatTime(inc.at)}</span>
                </div>
              ))}
            </div>
          )}
        </DarkCard>
      )}
    </div>
  );
}

function DarkCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
      <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
        <p className="card-title text-[13px] font-bold uppercase tracking-widest">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-[#5a6a84]">{description}</p>}
      </div>
      <div className="px-4 py-4 space-y-4">{children}</div>
    </div>
  );
}
