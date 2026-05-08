import { useEffect, useState, useCallback } from "react";
import { Funnel } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

type Preset = "today" | "7d" | "30d" | "month";

interface FunnelStep {
  key: string;
  label: string;
  sessions: number;
  stepConversionPct: number;
  startConversionPct: number;
}
interface FunnelData {
  from: string;
  to: string;
  filters: { device: string | null; country: string | null };
  steps: FunnelStep[];
}

function getDateRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let fromDate: Date;
  switch (preset) {
    case "today": fromDate = now; break;
    case "7d": fromDate = new Date(Date.now() - 7 * 86400000); break;
    case "month": fromDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "30d": default: fromDate = new Date(Date.now() - 30 * 86400000);
  }
  return { from: fromDate.toISOString().split("T")[0], to };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" }, { key: "7d", label: "7d" },
  { key: "30d", label: "30d" }, { key: "month", label: "MTD" },
];

const DEVICES: { key: string; label: string }[] = [
  { key: "", label: "All devices" }, { key: "desktop", label: "Desktop" },
  { key: "mobile", label: "Mobile" }, { key: "tablet", label: "Tablet" },
];

export default function AnalyticsFunnelPage() {
  const token = useAuthStore((s) => s.token);
  const [preset, setPreset] = useState<Preset>("30d");
  const [device, setDevice] = useState("");
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const { from, to } = getDateRange(preset);
    const params = new URLSearchParams({ from, to });
    if (device) params.set("device", device);
    try {
      const r = await fetch(`${API_URL}/admin/analytics/funnel?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setData(await r.json());
    } catch { /* swallow */ }
    setLoading(false);
  }, [token, preset, device]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxSessions = data ? Math.max(...data.steps.map((s) => s.sessions), 1) : 1;
  const startSessions = data?.steps[0]?.sessions ?? 0;
  const finalSessions = data?.steps.at(-1)?.sessions ?? 0;
  const overallPct = startSessions > 0 ? Math.round((finalSessions / startSessions) * 1000) / 10 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Funnel className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold tracking-tight">Checkout Funnel</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"} onClick={() => setPreset(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
        <select value={device} onChange={(e) => setDevice(e.target.value)} className="rounded border px-3 py-1.5 text-sm">
          {DEVICES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !data ? (
        <p className="text-muted-foreground">No data.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Start (sessions)</p>
              <p className="mt-1 text-2xl font-bold">{startSessions.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Orders created</p>
              <p className="mt-1 text-2xl font-bold">{finalSessions.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall conversion</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">{overallPct}%</p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-semibold mb-4">Step-by-step</h3>
            <div className="space-y-3">
              {data.steps.map((step, idx) => {
                const widthPct = Math.round((step.sessions / maxSessions) * 100);
                const dropFromPrev = idx > 0 ? 100 - step.stepConversionPct : 0;
                return (
                  <div key={step.key}>
                    <div className="flex items-baseline justify-between text-sm mb-1.5">
                      <span className="font-medium">{idx + 1}. {step.label}</span>
                      <span className="font-mono tabular-nums">
                        <span className="text-foreground font-semibold">{step.sessions.toLocaleString()}</span>
                        <span className="text-muted-foreground ml-2">{step.startConversionPct}% of start</span>
                        {idx > 0 && <span className={`ml-2 ${dropFromPrev > 50 ? "text-red-600" : dropFromPrev > 25 ? "text-amber-600" : "text-emerald-600"}`}>
                          {step.stepConversionPct}% from prev
                        </span>}
                      </span>
                    </div>
                    <div className="h-8 rounded bg-gray-100 overflow-hidden">
                      <div className="h-full bg-blue-500 flex items-center justify-end px-3 text-xs text-white font-medium transition-all" style={{ width: `${Math.max(widthPct, 1)}%` }}>
                        {widthPct >= 8 ? `${step.sessions}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Range: {new Date(data.from).toLocaleDateString()} – {new Date(data.to).toLocaleDateString()}
              {data.filters.device && ` · device: ${data.filters.device}`}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
