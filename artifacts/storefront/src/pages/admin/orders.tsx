import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  PENDING:            "border-amber-400   bg-amber-500/40   text-amber-100   font-bold",
  PROCESSING:         "border-sky-400     bg-sky-500/40     text-sky-100     font-bold",
  COMPLETED:          "border-emerald-400 bg-emerald-500/40 text-emerald-100 font-bold",
  FAILED:             "border-red-400     bg-red-500/40     text-red-100     font-bold",
  REFUNDED:           "border-violet-400  bg-violet-500/40  text-violet-100  font-bold",
  PARTIALLY_REFUNDED: "border-orange-400  bg-orange-500/40  text-orange-100  font-bold",
};

const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[5px] align-middle text-[12.5px] leading-none text-[#dde4f0]";
const thBase    = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";

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
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">Orders</h1>
        <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38]" onClick={exportCSV}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2.5 rounded-md border border-[#2d3344] bg-[#161a24] p-2.5">
        <div className="min-w-[200px] flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95ab]" />
            <input
              className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
              placeholder="Search order # or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <select
          className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
        <label className="flex h-8 items-center gap-1.5 whitespace-nowrap text-[13px] text-[#c8d0e0]">
          <input type="checkbox" className="rounded border-[#3d4558]" checked={hasCoupon} onChange={(e) => { setHasCoupon(e.target.checked); setPage(1); }} /> Coupon
        </label>
        <label className="flex h-8 items-center gap-1.5 whitespace-nowrap text-[13px] text-[#c8d0e0]">
          <input type="checkbox" className="rounded border-[#3d4558]" checked={hasCpp} onChange={(e) => { setHasCpp(e.target.checked); setPage(1); }} /> CPP
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#9ca8bc]">
        <span className="text-[#e8edf5]">{total} orders</span>
        <span>
          Revenue:{" "}
          <strong className="tabular-nums text-white">€{parseFloat(revenue).toLocaleString("en", { minimumFractionDigits: 2 })}</strong>
        </span>
        {selected.size > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-[#e8edf5]">{selected.size} selected</span>
            <Button size="sm" variant="outline" className="h-7 border-[#3d4558] bg-[#1a1f2e] text-[13px] text-[#e8edf5]" onClick={() => handleBulk("COMPLETED")}>
              Mark Completed
            </Button>
            <Button size="sm" variant="outline" className="h-7 border-[#3d4558] bg-[#1a1f2e] text-[13px] text-[#e8edf5]" onClick={() => handleBulk("FAILED")}>
              Mark Failed
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-[29px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{backgroundColor: "#1e2128"}}>
                <th className={`${thBase} w-9 text-center border-l-0`} style={{color:"#ffffff"}}>
                  <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="rounded border-[#4a5570] accent-sky-500" />
                </th>
                <th className={`${thBase} w-[160px]`} >Order #</th>
                <th className={`${thBase} min-w-[160px]`}>Customer</th>
                <th className={`${thBase} min-w-[180px]`}>Items</th>
                <th className={`${thBase} w-[90px] text-right`}>Total</th>
                <th className={`${thBase} w-[90px] text-right`}>Discount</th>
                <th className={`${thBase} w-[60px] text-center`}>CPP</th>
                <th className={`${thBase} w-[70px] text-center`}>Coupon</th>
                <th className={`${thBase} w-[130px] text-center`}>Status</th>
                <th className={`${thBase} w-[95px] text-center border-r-0`}>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`group transition-colors duration-75 ${
                    selected.has(r.id)
                      ? "bg-sky-500/10"
                      : idx % 2 === 0
                      ? "bg-[#0c1018] hover:bg-[#111825]"
                      : "bg-[#0f1520] hover:bg-[#141e2e]"
                  }`}
                >
                  <td className={`${tableCell} text-center border-l-0`}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-[#4a5570] accent-sky-500" />
                  </td>
                  <td className={tableCell}>
                    <Link to={`/admin/orders/${r.id}`} className="font-mono text-[11.5px] font-semibold text-sky-400 hover:text-sky-200 hover:underline underline-offset-2 whitespace-nowrap">
                      {r.orderNumber}
                    </Link>
                  </td>
                  <td className={`${tableCell} max-w-[180px] truncate text-[#dde4f0]`} title={r.guestEmail ?? ""}>
                    {r.guestEmail ?? "—"}
                  </td>
                  <td className={`${tableCell} max-w-[240px] truncate text-[#b8c4d8]`} title={r.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}>
                    {r.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ") || "—"}
                  </td>
                  <td className="border-b border-r border-[#252d40] px-2.5 py-[5px] align-middle leading-none text-right font-mono tabular-nums text-[13px] font-bold text-white">
                    €{r.totalUsd}
                  </td>
                  <td className={`border-b border-r border-[#1f2840] px-2.5 py-[5px] align-middle leading-none text-right font-mono tabular-nums text-[12px] ${parseFloat(r.discountUsd) > 0 ? "text-rose-300 font-bold" : "text-[#2e3850]"}`}>
                    {parseFloat(r.discountUsd) > 0 ? `-€${r.discountUsd}` : "—"}
                  </td>
                  <td className={`${tableCell} text-center`}>
                    {r.cppSelected ? (
                      <span className="inline-flex items-center rounded border border-purple-300 bg-purple-500/40 px-1.5 text-[10px] font-bold text-purple-100 tracking-wider" style={{height:17}}>CPP</span>
                    ) : (
                      <span className="text-[#2e3850]">—</span>
                    )}
                  </td>
                  <td className={`${tableCell} text-center`}>
                    {r.couponId ? (
                      <span className="inline-flex items-center rounded border border-amber-300 bg-amber-500/40 px-1.5 text-[10px] font-bold text-amber-100 tracking-wider" style={{height:17}}>YES</span>
                    ) : (
                      <span className="text-[#2e3850]">—</span>
                    )}
                  </td>
                  <td className={`${tableCell} text-center`}>
                    <span className={`inline-flex items-center justify-center rounded border px-2 text-[10px] font-bold tracking-wider uppercase ${STATUS_COLORS[r.status] ?? "border-[#4b5568] bg-[#2a3040] text-[#cbd5e1]"}`} style={{height:18, minWidth:90}}>
                      {r.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className={`${tableCell} text-center font-mono tabular-nums text-[#8fa0bb] border-r-0`}>
                    {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-[13px] text-[#4a5570]">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-[#9ca8bc]">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span>
            Page <span className="tabular-nums text-[#e8edf5]">{page}</span> of <span className="tabular-nums text-[#e8edf5]">{totalPages}</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
