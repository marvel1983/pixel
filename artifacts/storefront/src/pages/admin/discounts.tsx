import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Plus, ChevronLeft, ChevronRight, Ticket, BarChart3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Discount Codes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/discounts/bulk")}>Bulk Generate</Button>
          <Button onClick={() => navigate("/admin/discounts/new")}><Plus className="h-4 w-4 mr-1" /> Create Code</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Codes" value={stats.totalCodes} icon={<Ticket className="h-5 w-5 text-gray-400" />} />
        <StatCard label="Active" value={stats.activeCodes} icon={<span className="h-3 w-3 rounded-full bg-green-500 inline-block" />} />
        <StatCard label="Total Discount Given" value={`$${stats.totalDiscountGiven.toFixed(2)}`} icon={<BarChart3 className="h-5 w-5 text-blue-500" />} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="w-full rounded-md border pl-9 pr-3 py-2 text-sm" placeholder="Search codes..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="all">All Types</option>
          <option value="PERCENTAGE">Percentage</option>
          <option value="FIXED">Fixed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-3 font-medium text-muted-foreground">Code</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Value</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Min Order</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Usage</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Expiry</th>
                <th className="px-3 py-3 font-medium text-muted-foreground w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs font-bold">{r.code}</td>
                  <td className="px-3 py-3"><Badge variant="outline" className="text-xs">{r.discountType === "PERCENTAGE" ? "%" : "$"}</Badge></td>
                  <td className="px-3 py-3 font-medium">{r.discountType === "PERCENTAGE" ? `${r.discountValue}%` : `$${r.discountValue}`}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.minOrderUsd ? `$${r.minOrderUsd}` : "—"}</td>
                  <td className="px-3 py-3"><UsageBar used={r.usedCount} limit={r.usageLimit} /></td>
                  <td className="px-3 py-3">
                    <button onClick={() => toggleStatus(r.id)} className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer ${r.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                      {r.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/discounts/${r.id}`)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/discounts/${r.id}/usage`)}>
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <button onClick={() => deleteDiscount(r.id)} className="p-1 rounded hover:bg-red-100"><Trash2 className="h-4 w-4 text-red-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">No discount codes found</td></tr>}
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

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs text-muted-foreground">{used} / ∞</span>;
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{used}/{limit}</span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
      {icon}
      <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
