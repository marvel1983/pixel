import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Clock, Check, X, Trash2, MessageSquare, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Answer { id: number; answerText: string; isAdmin: boolean; authorName: string; createdAt: string }
interface QRow {
  question: { id: number; productId: number; askerName: string; askerEmail: string; questionText: string; status: string; createdAt: string };
  productName: string; productSlug: string;
  answers: Answer[];
}
interface Stats { pending: number; approved: number; rejected: number; total: number }

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function AdminQAPage() {
  const [rows, setRows] = useState<QRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<QRow | null>(null);
  const [answer, setAnswer] = useState("");
  const [savingAnswer, setSavingAnswer] = useState(false);
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const limit = 25;

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);

    Promise.all([
      fetch(`${API}/admin/qa?${params}`, { headers }).then((r) => r.json()),
      fetch(`${API}/admin/qa/stats`, { headers }).then((r) => r.json()),
    ]).then(([d, s]) => {
      setRows(d.questions || []);
      setTotal(d.total || 0);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [page, search, status, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: number, st: string) => {
    await fetch(`${API}/admin/qa/${id}/status`, { method: "PATCH", headers, body: JSON.stringify({ status: st }) });
    fetchData();
  };

  const deleteQ = async (id: number) => {
    await fetch(`${API}/admin/qa/${id}`, { method: "DELETE", headers });
    if (detail?.question.id === id) setDetail(null);
    fetchData();
  };

  const submitAnswer = async () => {
    if (!detail || !answer.trim()) return;
    setSavingAnswer(true);
    await fetch(`${API}/admin/qa/${detail.question.id}/answer`, { method: "POST", headers, body: JSON.stringify({ answer }) });
    toast({ title: "Answer posted", description: "The customer will be notified by email." });
    setAnswer("");
    setSavingAnswer(false);
    setDetail(null);
    fetchData();
  };

  const bulkAction = async (action: string) => {
    const ids = [...selected];
    if (action === "delete") {
      await fetch(`${API}/admin/qa/bulk-delete`, { method: "POST", headers, body: JSON.stringify({ ids }) });
    } else {
      await fetch(`${API}/admin/qa/bulk-status`, { method: "POST", headers, body: JSON.stringify({ ids, status: action }) });
    }
    setSelected(new Set());
    fetchData();
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Q&A Moderation</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
          { label: "Approved", value: stats.approved, color: "text-green-600" },
          { label: "Rejected", value: stats.rejected, color: "text-red-600" },
          { label: "Total", value: stats.total, color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className="w-full border rounded-md pl-9 pr-3 py-2 text-sm" placeholder="Search questions..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="border rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {selected.size > 0 && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => bulkAction("APPROVED")}>Approve ({selected.size})</Button>
            <Button size="sm" variant="outline" onClick={() => bulkAction("REJECTED")}>Reject ({selected.size})</Button>
            <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")}>Delete ({selected.size})</Button>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 w-8"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.question.id)) : new Set())} /></th>
              <th className="p-3 text-left">Question</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">Asker</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.question.id} className="hover:bg-muted/30">
                <td className="p-3"><input type="checkbox" checked={selected.has(r.question.id)} onChange={() => toggleSelect(r.question.id)} /></td>
                <td className="p-3 max-w-[240px]">
                  <p className="truncate">{r.question.questionText}</p>
                  {r.answers.length > 0 && <span className="text-xs text-muted-foreground">{r.answers.length} answer(s)</span>}
                </td>
                <td className="p-3 text-muted-foreground">{r.productName}</td>
                <td className="p-3">
                  <p className="font-medium">{r.question.askerName}</p>
                  <p className="text-xs text-muted-foreground">{r.question.askerEmail}</p>
                </td>
                <td className="p-3"><Badge className={STATUS_COLORS[r.question.status]}>{r.question.status}</Badge></td>
                <td className="p-3 text-muted-foreground text-xs">{new Date(r.question.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setDetail(r); setAnswer(""); }}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updateStatus(r.question.id, "APPROVED")}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => updateStatus(r.question.id, "REJECTED")}><X className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => deleteQ(r.question.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No questions found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {pages} ({total} questions)</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Question Detail</h3>
                <Badge className={STATUS_COLORS[detail.question.status]}>{detail.question.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Product: {detail.productName}</p>
                <p className="text-xs text-muted-foreground">By: {detail.question.askerName} ({detail.question.askerEmail})</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm">{detail.question.questionText}</p>
              </div>
              {detail.answers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Answers:</p>
                  {detail.answers.map((a) => (
                    <div key={a.id} className="border-l-2 border-green-300 pl-3">
                      <p className="text-xs font-medium">{a.authorName} {a.isAdmin && "(Admin)"}</p>
                      <p className="text-sm text-muted-foreground">{a.answerText}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">Post Admin Answer:</p>
                <Textarea placeholder="Type your answer..." value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
                <Button size="sm" onClick={submitAnswer} disabled={savingAnswer || !answer.trim()}>
                  {savingAnswer ? "Saving..." : "Post Answer & Approve"}
                </Button>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => { updateStatus(detail.question.id, "APPROVED"); setDetail(null); }}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => { updateStatus(detail.question.id, "REJECTED"); setDetail(null); }}>Reject</Button>
                <Button size="sm" variant="destructive" onClick={() => deleteQ(detail.question.id)}>Delete</Button>
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setDetail(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
