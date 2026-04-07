import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, Search, ChevronLeft, ChevronRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface LogEntry {
  id: number; userId: number | null; action: string;
  entityType: string | null; entityId: number | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null; userAgent: string | null;
  createdAt: string; userName: string | null; userEmail: string | null;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800", UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800", LOGIN: "bg-purple-100 text-purple-800",
  SETTINGS_CHANGE: "bg-yellow-100 text-yellow-800", EXPORT: "bg-gray-100 text-gray-800",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<LogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const limit = 50;
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/admin/audit-log/actions`, { headers }).then((r) => r.json()).then(setActions).catch(() => {});
  }, []);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action !== "all") params.set("action", action);
    if (search) params.set("search", search);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    fetch(`${API}/admin/audit-log?${params}`, { headers })
      .then((r) => r.json())
      .then((d) => { setLogs(d.logs); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [page, action, search, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (action !== "all") params.set("action", action);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    fetch(`${API}/admin/audit-log/export?${params}`, { headers })
      .then((r) => r.blob())
      .then((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "audit-log.csv"; a.click(); });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">{total} total events</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
      </div>
      <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search entity type..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-[160px]" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-[160px]" />
      </div>
      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">User</th><th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Target</th><th className="px-4 py-3">IP</th>
            <th className="px-4 py-3">Timestamp</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            : logs.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No audit events found</td></tr>
            : logs.map((log) => (
              <tr key={log.id} className="border-b cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelected(log)}>
                <td className="px-4 py-3">{log.userName || log.userEmail || "System"}</td>
                <td className="px-4 py-3"><Badge className={ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-800"} variant="secondary">{log.action}</Badge></td>
                <td className="px-4 py-3">{log.entityType}{log.entityId ? ` #${log.entityId}` : ""}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.ipAddress ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Event Details</SheetTitle></SheetHeader>
          {selected && <AuditDetail log={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AuditDetail({ log }: { log: LogEntry }) {
  const fields = [
    ["Event ID", String(log.id)], ["Action", log.action],
    ["User", log.userName || log.userEmail || "System"],
    ["Email", log.userEmail ?? "—"],
    ["Target", `${log.entityType ?? "—"}${log.entityId ? ` #${log.entityId}` : ""}`],
    ["IP Address", log.ipAddress ?? "—"],
    ["Timestamp", new Date(log.createdAt).toLocaleString()],
    ["User Agent", log.userAgent ?? "—"],
  ];
  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-3">
        {fields.map(([label, val]) => (
          <div key={label}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="text-sm break-all">{val}</p></div>
        ))}
      </div>
      {log.details && Object.keys(log.details).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Details</p>
          <pre className="rounded-md bg-gray-50 p-3 text-xs overflow-x-auto">{JSON.stringify(log.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
