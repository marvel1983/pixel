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
  CUSTOMER: "bg-gray-100 text-gray-700", ADMIN: "bg-blue-100 text-blue-800", SUPER_ADMIN: "bg-purple-100 text-purple-800",
};

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Customers</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<Users className="h-5 w-5 text-blue-600" />} label="Total Customers" value={stats.totalCustomers} bg="bg-blue-50" />
        <StatCard icon={<UserPlus className="h-5 w-5 text-green-600" />} label="New This Month" value={stats.newThisMonth} bg="bg-green-50" />
        <StatCard icon={<ShoppingBag className="h-5 w-5 text-orange-600" />} label="With Orders" value={stats.withOrders} bg="bg-orange-50" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="w-full rounded-md border pl-9 pr-3 py-2 text-sm" placeholder="Search name or email..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="ALL">All Roles</option>
          <option value="CUSTOMER">Customer</option>
          <option value="ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin</option>
        </select>
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={hasOrders} onChange={(e) => { setHasOrders(e.target.checked); setPage(1); }} /> Has Orders
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Email</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Username</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Role</th>
                <th className="px-3 py-3 font-medium text-muted-foreground text-right">Orders</th>
                <th className="px-3 py-3 font-medium text-muted-foreground text-right">Spent</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Last Order</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Mktg</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <Link to={`/admin/customers/${r.id}`} className="flex items-center gap-2 hover:underline">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                        {initials(r.firstName, r.lastName, r.email)}
                      </span>
                      <span className="text-sm font-medium">{r.firstName ?? ""} {r.lastName ?? ""}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.email}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.username ?? "—"}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[r.role]}`}>{r.role}</span></td>
                  <td className="px-3 py-3 text-right font-mono text-xs">{r.orderCount}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs font-semibold">${parseFloat(r.totalSpent).toFixed(2)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.lastOrder ? new Date(r.lastOrder).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-3 text-center">{r.marketingConsent ? <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</td>
                  <td className="px-3 py-3">
                    {r.isActive
                      ? <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Active</Badge>
                      : <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">Inactive</Badge>}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">No customers found</td></tr>}
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

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg}`}>{icon}</div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
