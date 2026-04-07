import { useEffect, useState, useCallback } from "react";
import { Search, Plus, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ClaimRow {
  id: number; metenziClaimId: string | null; customerEmail: string;
  reason: string; status: string; notes: string | null;
  adminNotes: string | null; resolvedAt: string | null;
  createdAt: string; updatedAt: string;
  keyMask: string | null; orderNumber: string | null;
}

interface Stats { open: number; resolved: number; avgResolutionMs: number | null }

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-yellow-100 text-yellow-800", IN_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800", DENIED: "bg-red-100 text-red-800",
  RESOLVED: "bg-gray-100 text-gray-800",
};

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defective", ALREADY_USED: "Already Used",
  WRONG_PRODUCT: "Wrong Product", NOT_RECEIVED: "Not Received", OTHER: "Other",
};

function formatDuration(ms: number | null): string {
  if (!ms) return "N/A";
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function AdminClaimsPage() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [stats, setStats] = useState<Stats>({ open: 0, resolved: 0, avgResolutionMs: null });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [reason, setReason] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const token = useAuthStore((s) => s.token);
  const limit = 50;

  const fetchClaims = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status !== "ALL") params.set("status", status);
    if (reason !== "ALL") params.set("reason", reason);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    fetch(`${API}/admin/claims?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.claims); setTotal(d.total); setStats(d.stats); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, status, reason, from, to]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const refreshClaim = async (id: number) => {
    setRefreshingId(id);
    await fetch(`${API}/admin/claims/${id}/refresh`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    setRefreshingId(null);
    fetchClaims();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Claims</h1>
        <Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4 mr-1" /> Submit Claim</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open" value={stats.open} icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />} />
        <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle className="h-5 w-5 text-green-500" />} />
        <StatCard label="Avg Resolution" value={formatDuration(stats.avgResolutionMs)} icon={<Clock className="h-5 w-5 text-blue-500" />} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={reason} onChange={(e) => { setReason(e.target.value); setPage(1); }}>
          <option value="ALL">All Reasons</option>
          {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-3 py-3 font-medium text-muted-foreground">Claim ID</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Key</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Order #</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Reason</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Notes</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Created</th>
                <th className="px-3 py-3 font-medium text-muted-foreground">Resolved</th>
                <th className="px-3 py-3 font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3 font-mono text-xs">{r.metenziClaimId ?? `#${r.id}`}</td>
                  <td className="px-3 py-3 font-mono text-xs">{r.keyMask ?? "—"}</td>
                  <td className="px-3 py-3 font-mono text-xs text-blue-600">{r.orderNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-xs">{r.customerEmail}</td>
                  <td className="px-3 py-3"><Badge variant="outline" className="text-xs">{REASON_LABELS[r.reason] ?? r.reason}</Badge></td>
                  <td className="px-3 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100"}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{r.notes ?? "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-3">
                    {r.metenziClaimId && (
                      <button onClick={() => refreshClaim(r.id)} className="p-1 rounded hover:bg-gray-200" title="Refresh from Metenzi" disabled={refreshingId === r.id}>
                        <RefreshCw className={`h-4 w-4 text-gray-500 ${refreshingId === r.id ? "animate-spin" : ""}`} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-12 text-center text-muted-foreground">No claims found</td></tr>}
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

      {showModal && <SubmitClaimModal token={token!} onClose={() => setShowModal(false)} onSubmit={fetchClaims} />}
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

interface OrderOption { id: number; orderNumber: string; email: string }
interface KeyOption { id: number; keyMask: string | null; productName: string; sku: string }

function SubmitClaimModal({ token, onClose, onSubmit }: { token: string; onClose: () => void; onSubmit: () => void }) {
  const [orderSearch, setOrderSearch] = useState("");
  const [orderOptions, setOrderOptions] = useState<OrderOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [keyOptions, setKeyOptions] = useState<KeyOption[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("DEFECTIVE");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orderSearch.trim()) { setOrderOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`${API}/admin/claims/orders?search=${encodeURIComponent(orderSearch)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()).then((d) => setOrderOptions(d.orders)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [orderSearch, token]);

  useEffect(() => {
    if (!selectedOrder) { setKeyOptions([]); return; }
    setEmail(selectedOrder.email);
    fetch(`${API}/admin/claims/keys-for-order/${selectedOrder.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json()).then((d) => setKeyOptions(d.keys)).catch(() => {});
  }, [selectedOrder, token]);

  const submit = async () => {
    if (!email.trim()) return;
    setSaving(true);
    await fetch(`${API}/admin/claims`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: selectedOrder?.id, licenseKeyId: selectedKeyId, customerEmail: email, reason, notes }),
    });
    setSaving(false);
    onSubmit();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Submit Claim</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Search Order</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input className="w-full rounded-md border pl-9 pr-3 py-2 text-sm" placeholder="Order # or email..."
                value={orderSearch} onChange={(e) => { setOrderSearch(e.target.value); setSelectedOrder(null); }} />
            </div>
            {orderOptions.length > 0 && !selectedOrder && (
              <div className="border rounded-md mt-1 max-h-32 overflow-y-auto">
                {orderOptions.map((o) => (
                  <button key={o.id} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b last:border-0"
                    onClick={() => { setSelectedOrder(o); setOrderOptions([]); }}>
                    <span className="font-mono">{o.orderNumber}</span> — {o.email}
                  </button>
                ))}
              </div>
            )}
            {selectedOrder && (
              <div className="mt-1 text-xs text-muted-foreground">
                Selected: <span className="font-mono">{selectedOrder.orderNumber}</span>
                <button className="ml-2 text-blue-600 underline" onClick={() => { setSelectedOrder(null); setSelectedKeyId(null); }}>change</button>
              </div>
            )}
          </div>

          {keyOptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">License Key</label>
              <select className="w-full rounded-md border px-3 py-2 text-sm" value={selectedKeyId ?? ""} onChange={(e) => setSelectedKeyId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Select key (optional)</option>
                {keyOptions.map((k) => (
                  <option key={k.id} value={k.id}>{k.keyMask ?? "Key"} — {k.productName} ({k.sku})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Customer Email *</label>
            <input className="w-full rounded-md border px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Reason *</label>
            <select className="w-full rounded-md border px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional details..." />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !email.trim()}>
              {saving ? "Submitting..." : "Submit Claim"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
