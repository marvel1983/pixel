import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface RefundRow {
  id: number; orderId: number; amountUsd: string; reason: string; notes: string | null;
  status: string; externalRefundId: string | null; failureReason: string | null;
  notifyCustomer: boolean; createdAt: string; processedAt: string | null;
  orderNumber: string; orderTotal: string; customerEmail: string | null;
  adminEmail: string; adminFirst: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800", PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800", FAILED: "bg-red-100 text-red-800",
};

const REASON_COLORS: Record<string, string> = {
  "Defective product": "bg-red-50 text-red-700", "Customer request": "bg-blue-50 text-blue-700",
  "Duplicate order": "bg-purple-50 text-purple-700", "Wrong product": "bg-orange-50 text-orange-700",
  "Other": "bg-gray-100 text-gray-700",
};

export default function RefundsPage() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const token = useAuthStore((s) => s.token);
  const limit = 25;

  const fetchRefunds = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`${API}/admin/refunds?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.refunds); setTotal(d.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, status, from, to]);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const handleRetry = async (id: number) => {
    if (!confirm("Retry this failed refund?")) return;
    await fetch(`${API}/admin/refunds/${id}/retry`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    fetchRefunds();
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Refunds</h1>
        <p className="text-muted-foreground">Track and manage order refunds</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className="w-full rounded-md border px-9 py-2 text-sm" placeholder="Search order # or email..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Order</th>
            <th className="px-4 py-3 text-left font-medium">Customer</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-left font-medium">Reason</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Initiated By</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b"><td colSpan={8} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
            )) : rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{r.orderNumber}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.customerEmail ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">${r.amountUsd}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className={REASON_COLORS[r.reason] ?? "bg-gray-100 text-gray-700"}>{r.reason}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className={STATUS_COLORS[r.status]}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.adminFirst ?? r.adminEmail}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  {r.status === "FAILED" && (
                    <Button variant="ghost" size="sm" onClick={() => handleRetry(r.id)}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Retry
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No refunds found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
