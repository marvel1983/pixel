import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <Card key={q} className={`cursor-pointer border-2 ${selectedQueue === q ? "border-blue-500" : "border-transparent"}`}
              onClick={() => setSelectedQueue(selectedQueue === q ? null : q)}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{q.replace("-", " ")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {["waiting", "active", "completed", "failed"].map((st) => (
                    <div key={st}>
                      <div className="text-lg font-bold">{s[st] ?? 0}</div>
                      <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[st]}`}>{st}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {metrics && metrics.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Metrics (Last Hour)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Queue</th>
                    <th className="text-right py-2 px-3">Throughput</th>
                    <th className="text-right py-2 px-3">Failed</th>
                    <th className="text-right py-2 px-3">Failure Rate</th>
                    <th className="text-right py-2 px-3">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.queue} className="border-b">
                      <td className="py-2 px-3 font-medium capitalize">{m.queue.replace("-", " ")}</td>
                      <td className="text-right py-2 px-3"><CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />{m.throughput}</td>
                      <td className="text-right py-2 px-3"><AlertTriangle className="w-3 h-3 inline mr-1 text-red-500" />{m.failed}</td>
                      <td className="text-right py-2 px-3">{m.failureRate}%</td>
                      <td className="text-right py-2 px-3"><Clock className="w-3 h-3 inline mr-1" />{m.avgDurationMs ? `${m.avgDurationMs}ms` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Failed Jobs {selectedQueue && <Badge variant="outline">{selectedQueue}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!failures || failures.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No failed jobs</p>
          ) : (
            <div className="space-y-3">
              {failures.map((f) => (
                <div key={f.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{f.name}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">{f.queue}</Badge>
                      <span className="text-xs text-muted-foreground ml-2">Attempts: {f.attempts} | Job #{f.id}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => retryMut.mutate(f.id)} disabled={retryMut.isPending}>
                      {retryMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 mr-1" />} Retry
                    </Button>
                  </div>
                  {f.lastError && <pre className="text-xs bg-red-50 text-red-800 p-2 rounded overflow-x-auto">{f.lastError}</pre>}
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Payload</summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(f.payload, null, 2)}</pre>
                  </details>
                  <div className="text-xs text-muted-foreground mt-1">{f.completedAt ? new Date(f.completedAt).toLocaleString() : ""}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
