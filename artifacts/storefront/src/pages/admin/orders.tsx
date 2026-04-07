import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface OrderRow {
  id: number; orderNumber: string; guestEmail: string | null; status: string;
  subtotalUsd: string; discountUsd: string; totalUsd: string;
  cppSelected: boolean; cppAmountUsd: string;
  couponId: number | null; createdAt: string;
  items: { productName: string; quantity: number }[]; itemCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800", PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800", FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800", PARTIALLY_REFUNDED: "bg-orange-100 text-orange-800",
};

export default function AdminOrdersPage() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [revenue, setRevenue] = useState("0");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasCoupon, setHasCoupon] = useState(false);
  const [hasCpp, setHasCpp] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const token = useAuthStore((s) => s.token);
  const limit = 25;

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (hasCoupon) params.set("hasCoupon", "true");
    if (hasCpp) params.set("hasCpp", "true");

    fetch(`${API}/admin/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.orders); setTotal(d.total); setRevenue(d.revenue); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, status, from, to, hasCoupon, hasCpp]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleBulk = async (bulkStatus: string) => {
    if (selected.size === 0 || !confirm(`Mark ${selected.size} orders as ${bulkStatus}?`)) return;
    await fetch(`${API}/admin/orders/bulk-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], status: bulkStatus }),
    });
    setSelected(new Set());
    fetchOrders();
  };

  const exportCSV = async () => {
    const params = new URLSearchParams();
    if (selected.size > 0) params.set("ids", [...selected].join(","));
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`${API}/admin/orders/export?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    selected.size === rows.length ? setSelected(new Set()) : setSelected(new Set(rows.map((r) => r.id)));
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <Button size="sm" variant="outline" onClick={exportCSV}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="w-full rounded-md border pl-9 pr-3 py-2 text-sm" placeholder="Search order # or email..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={hasCoupon} onChange={(e) => { setHasCoupon(e.target.checked); setPage(1); }} /> Coupon</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={hasCpp} onChange={(e) => { setHasCpp(e.target.checked); setPage(1); }} /> CPP</label>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{total} orders</span>
        <span>Revenue: <strong className="text-foreground">${parseFloat(revenue).toLocaleString("en", { minimumFractionDigits: 2 })}</strong></span>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span>{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => handleBulk("COMPLETED")}>Mark Completed</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulk("FAILED")}>Mark Failed</Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-3 w-8"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Items</th>
                <th className="px-3 py-3 font-medium text-muted-foreground text-right">Total</th>
                <th className="px-3 py-3 font-medium text-muted-foreground text-right">Discount</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">CPP</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Coupon</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td className="px-3 py-3"><Link to={`/admin/orders/${r.id}`} className="font-mono text-xs text-blue-600 hover:underline">{r.orderNumber}</Link></td>
                  <td className="px-3 py-3 text-muted-foreground text-xs">{r.guestEmail ?? "—"}</td>
                  <td className="px-3 py-3 text-xs max-w-[180px] truncate">{r.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ") || "—"}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold">${r.totalUsd}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-red-600">{parseFloat(r.discountUsd) > 0 ? `-$${r.discountUsd}` : "—"}</td>
                  <td className="px-3 py-3">{r.cppSelected ? <Badge variant="secondary" className="text-xs">CPP</Badge> : "—"}</td>
                  <td className="px-3 py-3">{r.couponId ? <Badge variant="secondary" className="text-xs">Yes</Badge> : "—"}</td>
                  <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
      )}
    </div>
  );
}
