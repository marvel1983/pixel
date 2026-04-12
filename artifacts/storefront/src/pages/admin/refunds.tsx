import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const STATUS_BADGE: Record<string, string> = {
  PENDING: "border-amber-500 bg-amber-500/20 text-amber-200",
  PROCESSING: "border-sky-500 bg-sky-500/20 text-sky-200",
  COMPLETED: "border-emerald-500 bg-emerald-500/20 text-emerald-200",
  FAILED: "border-red-500 bg-red-500/20 text-red-200",
};

const REASON_BADGE: Record<string, string> = {
  "Defective product": "border-red-600 bg-red-500/15 text-red-300",
  "Customer request": "border-sky-600 bg-sky-500/15 text-sky-300",
  "Duplicate order": "border-purple-600 bg-purple-500/15 text-purple-300",
  "Wrong product": "border-amber-600 bg-amber-500/15 text-amber-300",
  "Other": "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]",
};

const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[6px] align-middle text-[12.5px] leading-none text-[#dde4f0]";
const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";

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
    <div className="space-y-3 text-[#e8edf5]">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Refunds</h1>
        <p className="text-[13px] text-[#8fa0bb]">Track and manage order refunds</p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b95ab]" />
          <input className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none"
            placeholder="Search order # or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <input type="date" className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[29px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} min-w-[130px]`}>Order</th>
                <th className={`${thBase} min-w-[160px]`}>Customer</th>
                <th className={`${thBase} w-[90px] text-right`}>Amount</th>
                <th className={`${thBase} min-w-[140px]`}>Reason</th>
                <th className={`${thBase} w-[110px]`}>Status</th>
                <th className={`${thBase} min-w-[120px]`}>Initiated By</th>
                <th className={`${thBase} w-[100px]`}>Date</th>
                <th className={`${thBase} w-[80px] text-right border-r-0`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                  <td className={`${tableCell} font-mono text-[11px] text-[#dde4f0]`}>{r.orderNumber}</td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{r.customerEmail ?? "—"}</td>
                  <td className={`${tableCell} text-right font-mono font-semibold text-white`}>${r.amountUsd}</td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${REASON_BADGE[r.reason] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>{r.reason}</span>
                  </td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>{r.status}</span>
                  </td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{r.adminFirst ?? r.adminEmail}</td>
                  <td className={`${tableCell} text-[#8fa0bb] whitespace-nowrap`}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className={`${tableCell} text-right border-r-0`}>
                    {r.status === "FAILED" && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] text-amber-400 hover:text-amber-200 hover:bg-amber-500/10" onClick={() => handleRetry(r.id)}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-[13px] text-[#4a5570]">No refunds found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-[#9ca8bc]">
          <p className="text-[#8fa0bb]">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
