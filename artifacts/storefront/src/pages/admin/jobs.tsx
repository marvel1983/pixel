import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Play, Trash2, Clock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

function useApi<T>(path: string) {
  const token = useAuthStore((s) => s.token);
  return useQuery<T>({
    queryKey: ["admin-jobs", path],
    queryFn: () => fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    refetchInterval: 10_000,
  });
}

type QueueStats = Record<string, Record<string, number>>;
interface Metric { queue: string; throughput: number; failed: number; total: number; failureRate: string; avgDurationMs: number | null; }
interface Failure { id: number; queue: string; name: string; lastError: string | null; attempts: number; payload: Record<string, unknown>; completedAt: string; }

const STATUS_COLORS: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-800",
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

export default function AdminJobsPage() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const { data: stats } = useApi<QueueStats>("/admin/jobs/stats");
  const { data: metrics } = useApi<Metric[]>("/admin/jobs/metrics");
  const { data: failures } = useApi<Failure[]>(`/admin/jobs/failed${selectedQueue ? `?queue=${selectedQueue}` : ""}`);

  const retryMut = useMutation({
    mutationFn: (jobId: number) => fetch(`${API}/admin/jobs/${jobId}/retry`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-jobs"] }),
  });

  const clearMut = useMutation({
    mutationFn: () => fetch(`${API}/admin/jobs/completed`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-jobs"] }),
  });

  const queues = stats ? Object.keys(stats).sort() : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Job Queue Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-jobs"] })}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => clearMut.mutate()}>
            <Trash2 className="w-4 h-4 mr-1" /> Clear Completed
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queues.map((q) => {
          const s = stats![q];
          return (
            <div
              key={q}
              className={`rounded-lg border bg-[#181c24] cursor-pointer transition-colors ${selectedQueue === q ? "border-sky-500" : "border-[#2e3340]"}`}
              style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}
              onClick={() => setSelectedQueue(selectedQueue === q ? null : q)}
            >
              <div className="border-b border-[#2a2e3a] px-4 py-3 bg-[#1e2128]">
                <p className="text-[13px] font-bold uppercase tracking-widest text-[#dde4f0] capitalize">{q.replace("-", " ")}</p>
              </div>
              <div className="px-4 py-4">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {["waiting", "active", "completed", "failed"].map((st) => (
                    <div key={st}>
                      <div className="text-lg font-bold text-[#dde4f0]">{s[st] ?? 0}</div>
                      <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[st]}`}>{st}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {metrics && metrics.length > 0 && (
        <DarkCard title="Metrics (Last Hour)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1e2128]">
                  <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-left">Queue</th>
                  <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-right">Throughput</th>
                  <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-right">Failed</th>
                  <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-right">Failure Rate</th>
                  <th className="px-3 py-[8px] text-[10.5px] font-bold uppercase tracking-widest border-b border-[#2a2e3a] text-right">Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => (
                  <tr key={m.queue} className={i % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#111825]"}>
                    <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] font-medium capitalize">{m.queue.replace("-", " ")}</td>
                    <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] text-right"><CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />{m.throughput}</td>
                    <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] text-right"><AlertTriangle className="w-3 h-3 inline mr-1 text-red-500" />{m.failed}</td>
                    <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] text-right">{m.failureRate}%</td>
                    <td className="px-3 py-[6px] text-[12.5px] text-[#dde4f0] border-b border-[#1f2840] text-right"><Clock className="w-3 h-3 inline mr-1" />{m.avgDurationMs ? `${m.avgDurationMs}ms` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DarkCard>
      )}

      <DarkCard title={`Failed Jobs${selectedQueue ? ` — ${selectedQueue}` : ""}`}>
        {!failures || failures.length === 0 ? (
          <p className="text-[#5a6a84] text-sm py-4 text-center">No failed jobs</p>
        ) : (
          <div className="space-y-3">
            {failures.map((f) => (
              <div key={f.id} className="border border-[#2e3340] rounded-lg p-3 bg-[#0f1117]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-[#dde4f0]">{f.name}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">{f.queue}</Badge>
                    <span className="text-xs text-[#5a6a84] ml-2">Attempts: {f.attempts} | Job #{f.id}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => retryMut.mutate(f.id)} disabled={retryMut.isPending}>
                    {retryMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 mr-1" />} Retry
                  </Button>
                </div>
                {f.lastError && <pre className="text-xs bg-red-950/40 text-red-400 p-2 rounded overflow-x-auto">{f.lastError}</pre>}
                <details className="mt-1">
                  <summary className="text-xs text-[#5a6a84] cursor-pointer">Payload</summary>
                  <pre className="text-xs bg-[#0c1018] text-[#dde4f0] p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(f.payload, null, 2)}</pre>
                </details>
                <div className="text-xs text-[#5a6a84] mt-1">{f.completedAt ? new Date(f.completedAt).toLocaleString() : ""}</div>
              </div>
            ))}
          </div>
        )}
      </DarkCard>
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
