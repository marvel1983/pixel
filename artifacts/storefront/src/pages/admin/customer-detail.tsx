import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Star, Shield, Trash2, KeyRound, Ban, CheckCircle, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Customer {
  id: number; email: string; firstName: string | null; lastName: string | null;
  role: string; isActive: boolean; emailVerified: boolean; adminNotes: string | null;
  lastLoginAt: string | null; createdAt: string;
}
interface Order { id: number; orderNumber: string; status: string; totalUsd: string; createdAt: string }
interface WishlistItem { id: number; productId: number; productName: string; createdAt: string }
interface Review {
  id: number; productId: number; productName: string; rating: number; title: string | null;
  body: string | null; isApproved: boolean; isVerifiedPurchase: boolean; helpfulCount: number; createdAt: string;
}
interface Stats { totalSpent: string; orderCount: number; avgRating: number }
interface LoyaltyAccount { pointsBalance: number; lifetimePoints: number; tier: string; tierMultiplier: string }
interface LoyaltyTx { id: number; type: string; points: number; balance: number; description: string; createdAt: string }

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800", PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800", FAILED: "bg-red-100 text-red-800",
  REFUNDED: "bg-purple-100 text-purple-800",
};

export default function CustomerDetailPage() {
  const [, params] = useRoute("/admin/customers/:id");
  const [, navigate] = useLocation();
  const token = useAuthStore((s) => s.token);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOrders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [customerReviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats>({ totalSpent: "0", orderCount: 0, avgRating: 0 });
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [loyalty, setLoyalty] = useState<{ account: LoyaltyAccount | null; transactions: LoyaltyTx[] } | null>(null);
  const [adjustPts, setAdjustPts] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API}/admin/customers/${params.id}`, { headers: h })
      .then((r) => r.json()).then((d) => {
        setCustomer(d.customer); setOrders(d.orders); setWishlist(d.wishlist);
        setReviews(d.reviews); setStats(d.stats); setNotes(d.customer.adminNotes ?? "");
      }).catch(() => {}).finally(() => setLoading(false));
    fetch(`${API}/admin/customers/${params.id}/loyalty`, { headers: h })
      .then((r) => r.json()).then(setLoyalty).catch(() => {});
  }, [params?.id, token]);

  const api = async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  };

  const changeRole = async (role: string) => {
    if (!confirm(`Change role to ${role}?`)) return;
    const r = await api(`/admin/customers/${params!.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
    if (r) setCustomer((c) => c ? { ...c, role } : c);
  };

  const resetPassword = async () => {
    if (!confirm("Generate a new temporary password?")) return;
    const r = await api(`/admin/customers/${params!.id}/reset-password`, { method: "POST" });
    if (r) alert(`Temporary password: ${r.tempPassword}`);
  };

  const toggleActive = async () => {
    const r = await api(`/admin/customers/${params!.id}/toggle-active`, { method: "PATCH" });
    if (r) setCustomer((c) => c ? { ...c, isActive: r.isActive } : c);
  };

  const deleteCustomer = async () => {
    if (!confirm("Delete this customer permanently? This cannot be undone.")) return;
    const r = await api(`/admin/customers/${params!.id}`, { method: "DELETE" });
    if (r) navigate("/admin/customers");
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    await api(`/admin/customers/${params!.id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) });
    setSavingNotes(false);
  };

  const adjustLoyalty = async () => {
    const pts = parseInt(adjustPts);
    if (!pts || isNaN(pts)) { alert("Enter a valid points value"); return; }
    setAdjusting(true);
    const r = await api(`/admin/customers/${params!.id}/loyalty/adjust`, {
      method: "POST", body: JSON.stringify({ points: pts, note: adjustNote }),
    });
    if (r) {
      const h = { Authorization: `Bearer ${token}` };
      const lr = await fetch(`${API}/admin/customers/${params!.id}/loyalty`, { headers: h });
      setLoyalty(await lr.json());
      setAdjustPts(""); setAdjustNote("");
    }
    setAdjusting(false);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (!customer) return <div className="text-center py-12 text-muted-foreground">Customer not found</div>;

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
  const init = customer.firstName ? (customer.firstName[0] + (customer.lastName?.[0] ?? "")).toUpperCase() : customer.email.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/customers")}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{name}</h1>
        {!customer.isActive && <Badge variant="secondary" className="bg-red-100 text-red-700">Inactive</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Profile">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">{init}</div>
              <div className="flex-1 space-y-1 text-sm">
                <p><strong>Email:</strong> {customer.email} {customer.emailVerified && <CheckCircle className="inline h-3.5 w-3.5 text-green-500" />}</p>
                <p><strong>Role:</strong> <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${customer.role === "ADMIN" ? "bg-blue-100 text-blue-800" : customer.role === "SUPER_ADMIN" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"}`}>{customer.role}</span></p>
                <p><strong>Registered:</strong> {new Date(customer.createdAt).toLocaleDateString()}</p>
                <p><strong>Last Login:</strong> {customer.lastLoginAt ? new Date(customer.lastLoginAt).toLocaleString() : "Never"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              <select className="rounded-md border px-2 py-1 text-xs" value={customer.role} onChange={(e) => changeRole(e.target.value)}>
                <option value="CUSTOMER">Customer</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
              </select>
              <Button size="sm" variant="outline" onClick={resetPassword}><KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Password</Button>
              <Button size="sm" variant="outline" onClick={toggleActive}><Ban className="h-3.5 w-3.5 mr-1" /> {customer.isActive ? "Deactivate" : "Activate"}</Button>
              <Button size="sm" variant="destructive" onClick={deleteCustomer}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
            </div>
          </Section>

          <Section title={`Orders (${customerOrders.length})`}>
            {customerOrders.length > 0 ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-gray-50 text-left">
                  <th className="px-3 py-2 font-medium text-muted-foreground">Order #</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground text-right">Total</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2 font-medium text-muted-foreground">Date</th>
                </tr></thead>
                <tbody>{customerOrders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                    <td className="px-3 py-2 font-mono text-xs text-blue-600">{o.orderNumber}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-semibold">${o.totalUsd}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100"}`}>{o.status}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            ) : <p className="text-sm text-muted-foreground py-4 text-center">No orders yet</p>}
          </Section>

          <Section title={`Wishlist (${wishlist.length})`}>
            {wishlist.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">{wishlist.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span className="truncate">{w.productName}</span>
                  <span className="text-xs text-muted-foreground ml-2">{new Date(w.createdAt).toLocaleDateString()}</span>
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground py-4 text-center">No wishlist items</p>}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Stats">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Spent</span><span className="font-bold">${parseFloat(stats.totalSpent).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Orders</span><span className="font-bold">{stats.orderCount}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Rating</span><span className="font-bold">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Order Value</span><span className="font-bold">{stats.orderCount > 0 ? `$${(parseFloat(stats.totalSpent) / stats.orderCount).toFixed(2)}` : "—"}</span></div>
            </div>
          </Section>

          <Section title="Loyalty">
            <div className="space-y-3 text-sm">
              {loyalty?.account ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tier</span>
                    <Badge variant="secondary">{loyalty.account.tier}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-bold">{loyalty.account.pointsBalance.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lifetime</span>
                    <span className="font-bold">{loyalty.account.lifetimePoints.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiplier</span>
                    <span className="font-bold">{loyalty.account.tierMultiplier}x</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">No loyalty account yet. Use the form below to create one by adjusting points.</p>
              )}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium">Adjust Points</p>
                <Input type="number" placeholder="+100 or -50" value={adjustPts} onChange={(e) => setAdjustPts(e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Note (optional)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" className="w-full" onClick={adjustLoyalty} disabled={adjusting}>
                  <Trophy className="h-3.5 w-3.5 mr-1" /> {adjusting ? "Adjusting..." : "Adjust Points"}
                </Button>
              </div>
              {loyalty?.transactions && loyalty.transactions.length > 0 && (
                <div className="border-t pt-3 space-y-1 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium mb-2">Recent Transactions</p>
                  {loyalty.transactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex justify-between text-xs">
                      <span className="truncate flex-1 mr-2">{tx.description}</span>
                      <span className={tx.points > 0 ? "text-green-600" : "text-red-600"}>
                        {tx.points > 0 ? "+" : ""}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title={`Reviews (${customerReviews.length})`}>
            {customerReviews.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">{customerReviews.map((r) => (
                <div key={r.id} className="rounded border p-2 text-sm space-y-1">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />)}
                    {!r.isApproved && <Badge variant="secondary" className="text-xs ml-1">Pending</Badge>}
                  </div>
                  <p className="font-medium text-xs truncate">{r.productName}</p>
                  {r.title && <p className="text-xs font-semibold">{r.title}</p>}
                  {r.body && <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>}
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground py-4 text-center">No reviews</p>}
          </Section>

          <Section title="Admin Notes">
            <textarea className="w-full rounded-md border p-2 text-sm min-h-[80px]" value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this customer..." />
            <Button size="sm" className="mt-2 w-full" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
