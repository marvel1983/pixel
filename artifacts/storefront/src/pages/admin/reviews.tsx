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
  ratingGameplay: number | null; ratingGraphics: number | null;
  ratingValue: number | null; ratingSupport: number | null;
  status: string; helpfulCount: number; adminReply: string | null;
  adminReplyAt: string | null; createdAt: string;
  productName: string; userEmail: string; userFirstName: string | null; userLastName: string | null;
}
interface Stats { pending: number; approved: number; rejected: number; avgRating: number }

const STATUS_BADGE: Record<string, string> = {
  PENDING: "border-amber-500 bg-amber-500/20 text-amber-200",
  APPROVED: "border-emerald-500 bg-emerald-500/20 text-emerald-200",
  REJECTED: "border-red-500 bg-red-500/20 text-red-200",
};

const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[6px] align-middle text-[12.5px] leading-none text-[#dde4f0]";
const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";

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
    <div className="space-y-3 text-[#e8edf5]">
      <h1 className="text-2xl font-bold tracking-tight text-white">Review Moderation</h1>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Pending" value={stats.pending} accent="border-l-amber-500" icon={<Clock className="h-5 w-5 text-amber-400" />} />
        <StatCard label="Approved" value={stats.approved} accent="border-l-emerald-500" icon={<Check className="h-5 w-5 text-emerald-400" />} />
        <StatCard label="Rejected" value={stats.rejected} accent="border-l-red-500" icon={<X className="h-5 w-5 text-red-400" />} />
        <StatCard label="Avg Rating" value={stats.avgRating.toFixed(1)} accent="border-l-sky-500" icon={<Star className="h-5 w-5 text-sky-400" />} />
      </div>

      <div className="flex flex-wrap items-end gap-2.5 rounded-md border border-[#2d3344] bg-[#161a24] p-2.5">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95ab]" />
            <input className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none"
              placeholder="Search product or review..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
        </select>
        <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }}>
          <option value="ALL">All Ratings</option>{[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
        </select>
        <input type="date" className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <input type="date" className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[#8fa0bb]">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="h-7 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] text-[13px]" onClick={() => handleBulk("approve")}><Check className="h-3.5 w-3.5 mr-1" /> Approve All</Button>
          <Button size="sm" variant="outline" className="h-7 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] text-[13px]" onClick={() => handleBulk("reject")}><X className="h-3.5 w-3.5 mr-1" /> Reject All</Button>
          <Button size="sm" variant="destructive" className="h-7 text-[13px]" onClick={() => handleBulk("delete")}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete All</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[29px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} w-8`} style={{ color: "#ffffff" }}>
                  <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="rounded border-[#4a5570] accent-sky-500" />
                </th>
                <th className={`${thBase} min-w-[160px]`}>Product</th>
                <th className={`${thBase} min-w-[140px]`}>Reviewer</th>
                <th className={`${thBase} w-[90px]`}>Rating</th>
                <th className={`${thBase} w-[110px]`}>Sub-Ratings</th>
                <th className={`${thBase} min-w-[200px]`}>Review</th>
                <th className={`${thBase} w-[100px]`}>Status</th>
                <th className={`${thBase} w-[95px]`}>Date</th>
                <th className={`${thBase} w-[100px] border-r-0`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                  <td className={`${tableCell} text-center`}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-[#4a5570] accent-sky-500" />
                  </td>
                  <td className={`${tableCell} max-w-[160px] truncate font-medium`} title={r.productName}>{r.productName}</td>
                  <td className={`${tableCell} max-w-[140px] truncate text-[#8fa0bb]`}>
                    {reviewer(r)}
                    {r.isVerifiedPurchase && <span className="ml-1 inline-flex items-center rounded border border-emerald-600 bg-emerald-500/20 px-1 text-[9px] font-bold text-emerald-300">Verified</span>}
                  </td>
                  <td className={tableCell}><Stars n={r.rating} /></td>
                  <td className={`${tableCell} text-[10px] text-[#8fa0bb] leading-tight`}>
                    {r.ratingGameplay != null && <span>GP:{r.ratingGameplay} </span>}
                    {r.ratingGraphics != null && <span>GX:{r.ratingGraphics} </span>}
                    {r.ratingValue != null && <span>VL:{r.ratingValue} </span>}
                    {r.ratingSupport != null && <span>SP:{r.ratingSupport}</span>}
                    {r.ratingGameplay == null && r.ratingGraphics == null && r.ratingValue == null && r.ratingSupport == null && "—"}
                  </td>
                  <td className={`${tableCell} max-w-[220px]`}>
                    {r.title && <span className="font-semibold text-[#dde4f0]">{r.title} </span>}
                    <span className="text-[#8fa0bb] line-clamp-1">{r.body ?? ""}</span>
                    {r.adminReply && <MessageSquare className="inline h-3 w-3 ml-1 text-sky-400" />}
                  </td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[r.status] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>{r.status}</span>
                  </td>
                  <td className={`${tableCell} text-[#8fa0bb] whitespace-nowrap`}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className={`${tableCell} border-r-0`}>
                    <div className="flex items-center gap-1">
                      <button title="View" className="p-1 hover:bg-[#1e2a40] rounded text-[#8fa0bb] hover:text-white" onClick={() => openDetail(r)}><Eye className="h-3.5 w-3.5" /></button>
                      {r.status !== "APPROVED" && <button title="Approve" className="p-1 hover:bg-emerald-500/20 rounded text-emerald-400" onClick={() => setStatus_(r.id, "APPROVED")}><Check className="h-3.5 w-3.5" /></button>}
                      {r.status !== "REJECTED" && <button title="Reject" className="p-1 hover:bg-red-500/20 rounded text-red-400" onClick={() => setStatus_(r.id, "REJECTED")}><X className="h-3.5 w-3.5" /></button>}
                      <button title="Delete" className="p-1 hover:bg-red-500/20 rounded text-red-400" onClick={() => deleteReview(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-12 text-center text-[13px] text-[#4a5570]">No reviews found</td></tr>}
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

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetail(null)}>
          <div className="rounded-lg border border-[#2e3340] bg-[#181c24] shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{detail.productName}</h2>
                <p className="text-sm text-[#8fa0bb]">by {reviewer(detail)} {detail.isVerifiedPurchase && <span className="ml-1 inline-flex items-center rounded border border-emerald-600 bg-emerald-500/20 px-1.5 text-[10px] font-bold text-emerald-300">Verified</span>}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-[#8fa0bb] hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-2">
              <Stars n={detail.rating} />
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[detail.status] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>{detail.status}</span>
            </div>
            {(detail.ratingGameplay != null || detail.ratingGraphics != null || detail.ratingValue != null || detail.ratingSupport != null) && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#8fa0bb]">
                {detail.ratingGameplay != null && <span>Gameplay: <strong className="text-[#dde4f0]">{detail.ratingGameplay}/5</strong></span>}
                {detail.ratingGraphics != null && <span>Graphics: <strong className="text-[#dde4f0]">{detail.ratingGraphics}/5</strong></span>}
                {detail.ratingValue != null && <span>Value: <strong className="text-[#dde4f0]">{detail.ratingValue}/5</strong></span>}
                {detail.ratingSupport != null && <span>Support: <strong className="text-[#dde4f0]">{detail.ratingSupport}/5</strong></span>}
              </div>
            )}
            {detail.title && <h3 className="font-semibold text-[#dde4f0]">{detail.title}</h3>}
            <p className="text-sm whitespace-pre-wrap text-[#dde4f0]">{detail.body ?? "No review text"}</p>
            <p className="text-xs text-[#8fa0bb]">Helpful: {detail.helpfulCount} &middot; {new Date(detail.createdAt).toLocaleString()}</p>
            <div className="flex gap-2 pt-2 border-t border-[#2a2e3a]">
              <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5]" onClick={() => { setStatus_(detail.id, "APPROVED"); setDetail({ ...detail, status: "APPROVED" }); }}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
              <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5]" onClick={() => { setStatus_(detail.id, "REJECTED"); setDetail({ ...detail, status: "REJECTED" }); }}><X className="h-3.5 w-3.5 mr-1" /> Reject</Button>
              <Button size="sm" variant="destructive" onClick={() => deleteReview(detail.id)} className="ml-auto"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button>
            </div>
            <div className="space-y-2 pt-2 border-t border-[#2a2e3a]">
              <label className="text-sm font-medium text-[#dde4f0]">Admin Reply</label>
              <textarea
                className="w-full rounded border border-[#3d4558] bg-[#0f1117] p-2 text-sm text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none min-h-[80px]"
                value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply to this review..."
              />
              {detail.adminReplyAt && <p className="text-xs text-[#8fa0bb]">Last replied: {new Date(detail.adminReplyAt).toLocaleString()}</p>}
              <Button size="sm" onClick={saveReply} disabled={savingReply}>{savingReply ? "Saving..." : "Save Reply"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-yellow-400 text-yellow-400" : "text-[#2e3850]"}`} />)}</div>;
}

function StatCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-4 border-l-2 ${accent}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e2128]">{icon}</div>
      <div>
        <p className="text-[11px] text-[#8fa0bb] uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}
