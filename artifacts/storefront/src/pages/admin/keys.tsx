import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Eye, EyeOff, Copy, Flag, ChevronLeft, ChevronRight, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface KeyRow {
  id: number; maskedKey: string; status: string; source: string;
  productName: string; variantName: string; sku: string;
  orderNumber: string | null; customerEmail: string | null;
  soldAt: string | null; createdAt: string;
}

interface Stats { total: number; delivered: number; pending: number; claimed: number }

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800", SOLD: "bg-blue-100 text-blue-800",
  RESERVED: "bg-yellow-100 text-yellow-800", REVOKED: "bg-red-100 text-red-800",
};

export default function AdminKeysPage() {
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, delivered: 0, pending: 0, claimed: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [productId, setProductId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [productOptions, setProductOptions] = useState<{ id: number; name: string }[]>([]);
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [claimId, setClaimId] = useState<number | null>(null);
  const [claimReason, setClaimReason] = useState("");
  const [claimEmail, setClaimEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const token = useAuthStore((s) => s.token);
  const limit = 50;

  useEffect(() => {
    fetch(`${API}/admin/keys/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProductOptions(d.products))
      .catch(() => {});
  }, [token]);

  const fetchKeys = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (productId) params.set("productId", productId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`${API}/admin/keys?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.keys); setTotal(d.total); setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, status, productId, from, to]);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const revealKey = async (id: number) => {
    if (revealed[id]) {
      setRevealed((prev) => { const n = { ...prev }; delete n[id]; return n; });
      if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
      return;
    }
    if (!confirm("Reveal this license key? This action will be logged.")) return;
    const res = await fetch(`${API}/admin/keys/${id}/reveal`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.keyValue) {
      setRevealed((prev) => ({ ...prev, [id]: data.keyValue }));
      timers.current[id] = setTimeout(() => {
        setRevealed((prev) => { const n = { ...prev }; delete n[id]; return n; });
        delete timers.current[id];
      }, 30000);
    }
  };

  const copyKey = async (id: number, value: string) => {
    navigator.clipboard.writeText(value);
    fetch(`${API}/admin/keys/${id}/copy-audit`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  };

  const submitClaim = async () => {
    if (!claimId || !claimReason.trim()) return;
    setSaving(true);
    await fetch(`${API}/admin/keys/${claimId}/claim`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: claimReason, customerEmail: claimEmail }),
    });
    setSaving(false);
    setClaimId(null); setClaimReason(""); setClaimEmail("");
    fetchKeys();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">License Keys</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Keys" value={stats.total} icon={<Key className="h-5 w-5 text-gray-400" />} />
        <StatCard label="Delivered" value={stats.delivered} icon={<span className="h-3 w-3 rounded-full bg-blue-500 inline-block" />} />
        <StatCard label="Pending" value={stats.pending} icon={<span className="h-3 w-3 rounded-full bg-yellow-500 inline-block" />} />
        <StatCard label="Claimed" value={stats.claimed} icon={<span className="h-3 w-3 rounded-full bg-red-500 inline-block" />} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input className="w-full rounded-md border pl-9 pr-3 py-2 text-sm" placeholder="Search order #, product, SKU..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="rounded-md border px-3 py-2 text-sm max-w-[200px]" value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1); }}>
          <option value="">All Products</option>
          {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-3 font-medium text-muted-foreground">Key</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Product / SKU</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Created</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Sold</th>
                <th className="px-3 py-3 font-medium text-muted-foreground w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs">
                    {revealed[r.id] ? <span className="bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200">{revealed[r.id]}</span> : r.maskedKey}
                  </td>
                  <td className="px-3 py-3"><Badge variant="outline" className="text-xs">{r.source}</Badge></td>
                  <td className="px-3 py-3 text-xs"><div className="max-w-[160px] truncate">{r.productName}</div><div className="text-muted-foreground font-mono">{r.sku}</div></td>
                  <td className="px-3 py-3 font-mono text-xs text-blue-600">{r.orderNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{r.customerEmail ?? "—"}</td>
                  <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.soldAt ? new Date(r.soldAt).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => revealKey(r.id)} className="p-1 rounded hover:bg-gray-200" title={revealed[r.id] ? "Hide" : "Reveal"}>
                        {revealed[r.id] ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                      </button>
                      {revealed[r.id] && (
                        <button onClick={() => copyKey(r.id, revealed[r.id])} className="p-1 rounded hover:bg-gray-200" title="Copy">
                          <Copy className="h-4 w-4 text-gray-500" />
                        </button>
                      )}
                      {r.status === "SOLD" && (
                        <button onClick={() => setClaimId(r.id)} className="p-1 rounded hover:bg-orange-100" title="Submit Claim">
                          <Flag className="h-4 w-4 text-orange-500" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">No keys found</td></tr>}
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

      {claimId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setClaimId(null)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Submit Claim</h3>
            <p className="text-sm text-muted-foreground mb-3">This will revoke key #{claimId} and log a claim entry.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Customer Email</label>
                <input className="w-full rounded-md border px-3 py-2 text-sm" value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)} placeholder="customer@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reason *</label>
                <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={claimReason}
                  onChange={(e) => setClaimReason(e.target.value)} placeholder="Describe the claim reason..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setClaimId(null)}>Cancel</Button>
                <Button onClick={submitClaim} disabled={saving || !claimReason.trim()}>
                  {saving ? "Submitting..." : "Submit Claim"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
      {icon}
      <div><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
