import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Search, ChevronLeft, ChevronRight, Users, UserPlus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface CustomerRow {
  id: number; email: string; username: string | null; firstName: string | null; lastName: string | null;
  role: string; isActive: boolean; emailVerified: boolean; marketingConsent: boolean;
  lastLoginAt: string | null; createdAt: string;
  orderCount: number; totalSpent: string; lastOrder: string | null;
}

interface Stats { totalCustomers: number; newThisMonth: number; withOrders: number }

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]",
  ADMIN: "border-sky-600 bg-sky-500/20 text-sky-200",
  SUPER_ADMIN: "border-purple-600 bg-purple-500/20 text-purple-200",
};

const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[6px] align-middle text-[12.5px] leading-none text-[#dde4f0]";
const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";

function initials(first: string | null, last: string | null, email: string) {
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ totalCustomers: 0, newThisMonth: 0, withOrders: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasOrders, setHasOrders] = useState(false);
  const token = useAuthStore((s) => s.token);
  const limit = 25;

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (role !== "ALL") params.set("role", role);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (hasOrders) params.set("hasOrders", "true");

    fetch(`${API}/admin/customers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.customers); setTotal(d.total); setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, role, from, to, hasOrders]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-3 text-[#e8edf5]">
      <h1 className="text-2xl font-bold tracking-tight text-white">Customers</h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Users className="h-5 w-5 text-sky-400" />} label="Total Customers" value={stats.totalCustomers} accent="border-l-sky-500" />
        <StatCard icon={<UserPlus className="h-5 w-5 text-emerald-400" />} label="New This Month" value={stats.newThisMonth} accent="border-l-emerald-500" />
        <StatCard icon={<ShoppingBag className="h-5 w-5 text-amber-400" />} label="With Orders" value={stats.withOrders} accent="border-l-amber-500" />
      </div>

      <div className="flex flex-wrap items-end gap-2.5 rounded-md border border-[#2d3344] bg-[#161a24] p-2.5">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95ab]" />
            <input
              className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
              placeholder="Search name or email..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
        <select
          className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]"
          value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}
        >
          <option value="ALL">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <input type="date" className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <label className="flex h-8 items-center gap-1.5 whitespace-nowrap text-[13px] text-[#c8d0e0]">
          <input type="checkbox" className="rounded border-[#3d4558]" checked={hasOrders} onChange={(e) => { setHasOrders(e.target.checked); setPage(1); }} /> Has Orders
        </label>
      </div>

      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[29px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} min-w-[160px]`}>Customer</th>
                <th className={`${thBase} min-w-[180px]`}>Email</th>
                <th className={`${thBase} min-w-[110px]`}>Username</th>
                <th className={`${thBase} w-[100px]`}>Role</th>
                <th className={`${thBase} w-[70px] text-right`}>Orders</th>
                <th className={`${thBase} w-[90px] text-right`}>Spent</th>
                <th className={`${thBase} w-[110px]`}>Last Order</th>
                <th className={`${thBase} w-[60px] text-center`}>Mktg</th>
                <th className={`${thBase} w-[80px]`}>Status</th>
                <th className={`${thBase} w-[110px] border-r-0`}>Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}
                >
                  <td className={tableCell}>
                    <Link to={`/admin/customers/${r.id}`} className="flex items-center gap-2 hover:underline underline-offset-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-300 border border-sky-500/30">
                        {initials(r.firstName, r.lastName, r.email)}
                      </span>
                      <span className="text-[12.5px] font-medium text-[#dde4f0]">{r.firstName ?? ""} {r.lastName ?? ""}</span>
                    </Link>
                  </td>
                  <td className={`${tableCell} max-w-[200px] truncate text-[#8fa0bb]`} title={r.email}>{r.email}</td>
                  <td className={`${tableCell} font-mono text-[11px] text-[#8fa0bb]`}>{r.username ?? "—"}</td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[r.role] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>
                      {r.role}
                    </span>
                  </td>
                  <td className={`${tableCell} text-right font-mono tabular-nums text-[#dde4f0]`}>{r.orderCount}</td>
                  <td className={`${tableCell} text-right font-mono tabular-nums text-[13px] font-semibold text-white`}>${parseFloat(r.totalSpent).toFixed(2)}</td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{r.lastOrder ? new Date(r.lastOrder).toLocaleDateString() : "—"}</td>
                  <td className={`${tableCell} text-center`}>
                    {r.marketingConsent
                      ? <span className="inline-flex items-center rounded border border-emerald-600 bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-200" style={{ height: 17 }}>Yes</span>
                      : <span className="text-[#2e3850]">No</span>}
                  </td>
                  <td className={tableCell}>
                    {r.isActive
                      ? <span className="inline-flex items-center rounded border border-emerald-600 bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-200" style={{ height: 17 }}>Active</span>
                      : <span className="inline-flex items-center rounded border border-red-600 bg-red-500/20 px-1.5 text-[10px] font-bold text-red-200" style={{ height: 17 }}>Inactive</span>}
                  </td>
                  <td className={`${tableCell} text-[#8fa0bb] whitespace-nowrap border-r-0`}>{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-12 text-center text-[13px] text-[#4a5570]">No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-[#9ca8bc]">
          <Button size="sm" variant="outline" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40"
            disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Previous
          </Button>
          <span>Page <span className="tabular-nums text-[#e8edf5]">{page}</span> of <span className="tabular-nums text-[#e8edf5]">{totalPages}</span></span>
          <Button size="sm" variant="outline" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40"
            disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-4 border-l-2 ${accent}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e2128]">{icon}</div>
      <div>
        <p className="text-[11px] text-[#8fa0bb] uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
