import { useState, useEffect } from "react";
import { Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";
const REFRESH = 15_000;

interface VisitorEntry {
  sessionId: string;
  path: string;
  referrer: string;
  device: "mobile" | "tablet" | "desktop";
  secondsOnSite: number;
  lastSeen: number;
}

interface LiveStats {
  total: number;
  pages: { path: string; count: number }[];
  visitors: VisitorEntry[];
}

function DeviceIcon({ device }: { device: VisitorEntry["device"] }) {
  if (device === "mobile") return <Smartphone className="h-3 w-3" />;
  if (device === "tablet") return <Tablet className="h-3 w-3" />;
  return <Monitor className="h-3 w-3" />;
}

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function LiveVisitorsWidget() {
  const token = useAuthStore.getState().token;
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`${API}/admin/visitors/live`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setStats(d); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, REFRESH);
    return () => clearInterval(id);
  }, [token]);

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "#0f1117", border: "1px solid #1e2130" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold" style={{ color: "#e2e8f0" }}>
          Live Visitors
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full animate-pulse"
            style={{ background: "#22c55e" }}
          />
          <span className="text-lg font-bold" style={{ color: "#22c55e" }}>
            {stats?.total ?? 0}
          </span>
          <span className="text-[10px]" style={{ color: "#4a5568" }}>online now</span>
        </div>
      </div>

      {stats && stats.pages.length > 0 && (
        <div className="mb-3 space-y-1">
          {stats.pages.slice(0, 5).map((p) => (
            <div key={p.path} className="flex items-center gap-2">
              <div
                className="h-1.5 rounded-full"
                style={{
                  background: "#3b82f6",
                  width: `${Math.round((p.count / stats.total) * 100)}%`,
                  minWidth: "8px",
                  maxWidth: "120px",
                }}
              />
              <span className="text-[10px] truncate max-w-[140px]" style={{ color: "#94a3b8" }}>{p.path}</span>
              <span className="ml-auto text-[10px] font-medium" style={{ color: "#e2e8f0" }}>{p.count}</span>
            </div>
          ))}
        </div>
      )}

      {stats && stats.visitors.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {stats.visitors.map((v) => (
            <div
              key={v.sessionId}
              className="flex items-center gap-2 rounded px-2 py-1"
              style={{ background: "#1a1d28" }}
            >
              <span style={{ color: "#4a5568" }}>
                <DeviceIcon device={v.device} />
              </span>
              <span className="text-[10px] truncate flex-1" style={{ color: "#94a3b8" }}>{v.path}</span>
              {v.referrer && (
                <span title={v.referrer}>
                  <Globe className="h-3 w-3 shrink-0" style={{ color: "#4a5568" }} />
                </span>
              )}
              <span className="text-[10px] shrink-0" style={{ color: "#4a5568" }}>
                {formatDuration(v.secondsOnSite)}
              </span>
            </div>
          ))}
        </div>
      )}

      {(!stats || stats.total === 0) && (
        <p className="text-[11px]" style={{ color: "#4a5568" }}>No active visitors right now.</p>
      )}
    </div>
  );
}
