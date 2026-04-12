import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Plus, ChevronLeft, ChevronRight, Ticket, BarChart3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Discount {
  id: number; code: string; discountType: string; discountValue: string;
  minOrderUsd: string | null; maxDiscountUsd: string | null;
  usageLimit: number | null; usedCount: number; isActive: boolean;
  expiresAt: string | null; createdAt: string; bulkGroupId: string | null;
}

interface Stats { totalCodes: number; activeCodes: number; totalDiscountGiven: number }

const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[6px] align-middle text-[12.5px] leading-none text-[#dde4f0]";
const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";

export default function AdminDiscountsPage() {
  const [rows, setRows] = useState<Discount[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCodes: 0, activeCodes: 0, totalDiscountGiven: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);
  const limit = 50;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);

    fetch(`${API}/admin/discounts?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.discounts); setTotal(d.total); setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStatus = async (id: number) => {
    await fetch(`${API}/admin/discounts/${id}/toggle`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  };

  const deleteDiscount = async (id: number) => {
    if (!confirm("Delete this discount code?")) return;
    await fetch(`${API}/admin/discounts/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Discount Codes</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38]" onClick={() => navigate("/admin/discounts/bulk")}>Bulk Generate</Button>
          <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => navigate("/admin/discounts/new")}><Plus className="h-4 w-4 mr-1" /> Create Code</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Codes" value={stats.totalCodes} accent="border-l-[#8fa0bb]" icon={<Ticket className="h-5 w-5 text-[#8fa0bb]" />} />
        <StatCard label="Active" value={stats.activeCodes} accent="border-l-emerald-500" icon={<span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />} />
        <StatCard label="Total Discount Given" value={`$${stats.totalDiscountGiven.toFixed(2)}`} accent="border-l-sky-500" icon={<BarChart3 className="h-5 w-5 text-sky-400" />} />
      </div>

      <div className="flex flex-wrap items-end gap-2.5 rounded-md border border-[#2d3344] bg-[#161a24] p-2.5">
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95ab]" />
            <input className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none"
              placeholder="Search codes..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="all">All Types</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[29px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} min-w-[130px]`}>Code</th>
                <th className={`${thBase} w-[70px]`}>Type</th>
                <th className={`${thBase} w-[90px]`}>Value</th>
                <th className={`${thBase} w-[100px]`}>Min Order</th>
                <th className={`${thBase} min-w-[130px]`}>Usage</th>
                <th className={`${thBase} w-[90px]`}>Status</th>
                <th className={`${thBase} w-[100px]`}>Expiry</th>
                <th className={`${thBase} w-[120px] border-r-0`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                  <td className={`${tableCell} font-mono text-[11.5px] font-bold text-[#e8edf5]`}>{r.code}</td>
                  <td className={tableCell}>
                    <span className="inline-flex items-center rounded border border-[#3d4558] bg-[#1a1f2e] px-2 py-0.5 text-[10px] font-bold text-[#c8d0e0]">
                      {r.discountType === "PERCENTAGE" ? "%" : "$"}
                    </span>
                  </td>
                  <td className={`${tableCell} font-medium text-white`}>{r.discountType === "PERCENTAGE" ? `${r.discountValue}%` : `$${r.discountValue}`}</td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{r.minOrderUsd ? `$${r.minOrderUsd}` : "—"}</td>
                  <td className={tableCell}><UsageBar used={r.usedCount} limit={r.usageLimit} /></td>
                  <td className={tableCell}>
                    <button onClick={() => toggleStatus(r.id)} className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium cursor-pointer transition-opacity hover:opacity-80 ${r.isActive ? "border-emerald-600 bg-emerald-500/20 text-emerald-200" : "border-[#3d4558] bg-[#1a1f2e] text-[#8fa0bb]"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className={`${tableCell} text-[#8fa0bb] whitespace-nowrap`}>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td className={`${tableCell} border-r-0`}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-[11px] text-[#8fa0bb] hover:text-white hover:bg-[#1e2a40]" onClick={() => navigate(`/admin/discounts/${r.id}`)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[#8fa0bb] hover:text-sky-400 hover:bg-[#1e2a40]" onClick={() => navigate(`/admin/discounts/${r.id}/usage`)}>
                        <BarChart3 className="h-3.5 w-3.5" />
                      </Button>
                      <button onClick={() => deleteDiscount(r.id)} className="p-1 rounded hover:bg-red-500/20 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-12 text-center text-[13px] text-[#4a5570]">No discount codes found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-[#9ca8bc]">
          <Button size="sm" variant="outline" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40"
            disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Previous</Button>
          <span>Page <span className="tabular-nums text-[#e8edf5]">{page}</span> of <span className="tabular-nums text-[#e8edf5]">{totalPages}</span></span>
          <Button size="sm" variant="outline" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40"
            disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
        </div>
      )}
    </div>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-[12px] text-[#8fa0bb] font-mono">{used} / ∞</span>;
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-[#1a1f2e] rounded-full overflow-hidden border border-[#2e3340]">
        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] text-[#8fa0bb] font-mono tabular-nums">{used}/{limit}</span>
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: number | string; accent: string; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-4 border-l-2 ${accent}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e2128]">{icon}</div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-[11px] text-[#8fa0bb] uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
