import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Star, Clock, Check, X, Trash2, MessageSquare, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ReviewRow {
  id: number; productId: number; userId: number; rating: number;
  title: string | null; body: string | null; isVerifiedPurchase: boolean;
  status: string; helpfulCount: number; adminReply: string | null;
  adminReplyAt: string | null; createdAt: string;
  productName: string; userEmail: string; userFirstName: string | null; userLastName: string | null;
}
interface Stats { pending: number; approved: number; rejected: number; avgRating: number }

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800", APPROVED: "bg-green-100 text-green-800", REJECTED: "bg-red-100 text-red-800",
};

export default function AdminReviewsPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0, avgRating: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rating, setRating] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<ReviewRow | null>(null);
  const [reply, setReply] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  const token = useAuthStore((s) => s.token);
  const limit = 25;

  const fetchReviews = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    if (rating !== "ALL") params.set("rating", rating);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    fetch(`${API}/admin/reviews?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.reviews); setTotal(d.total); setStats(d.stats); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [token, page, search, status, rating, from, to]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const api = async (path: string, opts?: RequestInit) => {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...opts?.headers } });
    if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); alert(e.error); return null; }
    return r.json();
  };

  const setStatus_ = async (id: number, s: string) => { const r = await api(`/admin/reviews/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: s }) }); if (r) fetchReviews(); };
  const deleteReview = async (id: number) => { if (!confirm("Delete this review?")) return; const r = await api(`/admin/reviews/${id}`, { method: "DELETE" }); if (r) { fetchReviews(); if (detail?.id === id) setDetail(null); } };

  const handleBulk = async (action: string) => {
    if (selected.size === 0) return;
    if (!confirm(`${action} ${selected.size} reviews?`)) return;
    const r = await api("/admin/reviews/bulk", { method: "POST", body: JSON.stringify({ ids: [...selected], action }) });
    if (r) { setSelected(new Set()); fetchReviews(); }
  };

  const openDetail = (r: ReviewRow) => { setDetail(r); setReply(r.adminReply ?? ""); };
  const saveReply = async () => {
    if (!detail) return;
    setSavingReply(true);
    const r = await api(`/admin/reviews/${detail.id}/reply`, { method: "PATCH", body: JSON.stringify({ reply }) });
    setSavingReply(false);
    if (r) { setDetail({ ...detail, adminReply: reply || null, adminReplyAt: reply ? new Date().toISOString() : null }); fetchReviews(); }
  };

  const toggleSelect = (id: number) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const toggleAll = () => { selected.size === rows.length ? setSelected(new Set()) : setSelected(new Set(rows.map((r) => r.id))); };
  const totalPages = Math.ceil(total / limit);
  const reviewer = (r: ReviewRow) => [r.userFirstName, r.userLastName].filter(Boolean).join(" ") || r.userEmail;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Review Moderation</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Pending" value={stats.pending} color="text-yellow-600" bg="bg-yellow-50" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Approved" value={stats.approved} color="text-green-600" bg="bg-green-50" icon={<Check className="h-5 w-5" />} />
        <StatCard label="Rejected" value={stats.rejected} color="text-red-600" bg="bg-red-50" icon={<X className="h-5 w-5" />} />
        <StatCard label="Avg Rating" value={stats.avgRating.toFixed(1)} color="text-blue-600" bg="bg-blue-50" icon={<Star className="h-5 w-5" />} />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="flex-1 min-w-[200px]"><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input className="w-full rounded-md border pl-9 pr-3 py-2 text-sm" placeholder="Search product or review..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div></div>
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm" value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
          <option value="ALL">All Ratings</option>{[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
        </select>
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="rounded-md border px-3 py-2 text-sm" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulk("approve")}><Check className="h-3.5 w-3.5 mr-1" /> Approve All</Button>
          <Button size="sm" variant="outline" onClick={() => handleBulk("reject")}><X className="h-3.5 w-3.5 mr-1" /> Reject All</Button>
          <Button size="sm" variant="destructive" onClick={() => handleBulk("delete")}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete All</Button>
        </div>
      )}

      {loading ? <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div> : (
        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50 text-left">
              <th className="px-3 py-3 w-8"><input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} /></th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Product</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Reviewer</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Rating</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Review</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Date</th>
              <th className="px-3 py-3 font-medium text-muted-foreground">Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                  <td className="px-3 py-3 text-xs font-medium max-w-[160px] truncate">{r.productName}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{reviewer(r)}{r.isVerifiedPurchase && <Badge variant="secondary" className="ml-1 text-[10px]">Verified</Badge>}</td>
                  <td className="px-3 py-3"><Stars n={r.rating} /></td>
                  <td className="px-3 py-3 text-xs max-w-[220px]">
                    {r.title && <span className="font-semibold">{r.title} </span>}
                    <span className="text-muted-foreground line-clamp-1">{r.body ?? ""}</span>
                    {r.adminReply && <MessageSquare className="inline h-3 w-3 ml-1 text-blue-500" />}
                  </td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button title="View" className="p-1 hover:bg-gray-100 rounded" onClick={() => openDetail(r)}><Eye className="h-3.5 w-3.5" /></button>
                      {r.status !== "APPROVED" && <button title="Approve" className="p-1 hover:bg-green-50 rounded text-green-600" onClick={() => setStatus_(r.id, "APPROVED")}><Check className="h-3.5 w-3.5" /></button>}
                      {r.status !== "REJECTED" && <button title="Reject" className="p-1 hover:bg-red-50 rounded text-red-600" onClick={() => setStatus_(r.id, "REJECTED")}><X className="h-3.5 w-3.5" /></button>}
                      <button title="Delete" className="p-1 hover:bg-red-50 rounded text-red-500" onClick={() => deleteReview(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">No reviews found</td></tr>}
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

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">{detail.productName}</h2>
                <p className="text-sm text-muted-foreground">by {reviewer(detail)} {detail.isVerifiedPurchase && <Badge variant="secondary" className="text-[10px]">Verified Purchase</Badge>}</p>
              </div>
              <button onClick={() => setDetail(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-2"><Stars n={detail.rating} /><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[detail.status]}`}>{detail.status}</span></div>
            {detail.title && <h3 className="font-semibold">{detail.title}</h3>}
            <p className="text-sm whitespace-pre-wrap">{detail.body ?? "No review text"}</p>
            <p className="text-xs text-muted-foreground">Helpful: {detail.helpfulCount} &middot; {new Date(detail.createdAt).toLocaleString()}</p>
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => { setStatus_(detail.id, "APPROVED"); setDetail({ ...detail, status: "APPROVED" }); }}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
              <Button size="sm" variant="outline" onClick={() => { setStatus_(detail.id, "REJECTED"); setDetail({ ...detail, status: "REJECTED" }); }}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
              <Button size="sm" variant="destructive" onClick={() => deleteReview(detail.id)} className="ml-auto"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <label className="text-sm font-medium">Admin Reply</label>
              <textarea className="w-full rounded-md border p-2 text-sm min-h-[80px]" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply to this review..." />
              {detail.adminReplyAt && <p className="text-xs text-muted-foreground">Last replied: {new Date(detail.adminReplyAt).toLocaleString()}</p>}
              <Button size="sm" onClick={saveReply} disabled={savingReply}>{savingReply ? "Saving..." : "Save Reply"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />)}</div>;
}

function StatCard({ label, value, color, bg, icon }: { label: string; value: string | number; color: string; bg: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${bg} ${color}`}>{icon}</div>
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></div>
    </div>
  );
}
