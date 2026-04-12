import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Plus, Ban, CheckCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "border-emerald-500 bg-emerald-500/20 text-emerald-200",
  REDEEMED: "border-sky-500 bg-sky-500/20 text-sky-200",
  EXPIRED: "border-[#3d4558] bg-[#1a1f2e] text-[#8fa0bb]",
  DEACTIVATED: "border-red-500 bg-red-500/20 text-red-200",
};

interface GC {
  id: number; code: string; initialAmountUsd: string; balanceUsd: string;
  status: string; recipientEmail: string | null; recipientName: string | null;
  senderName: string | null; isManual: boolean; createdAt: string;
}

interface Redemption {
  id: number; amountUsd: string; balanceBefore: string; balanceAfter: string;
  createdAt: string; orderNumber: string;
}

const tableCell = "border-b border-r border-[#1f2840] px-2.5 py-[6px] align-middle text-[12.5px] leading-none text-[#dde4f0]";
const thBase = "border-b border-r border-[#2a2e3a] bg-[#1e2128] px-2.5 py-[8px] text-[10.5px] font-bold uppercase tracking-widest select-none whitespace-nowrap card-title";

export default function AdminGiftCardsPage() {
  const [rows, setRows] = useState<GC[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const token = useAuthStore((s) => s.token);
  const limit = 25;

  const fetchCards = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status !== "ALL") params.set("status", status);
    fetch(`${API}/admin/gift-cards?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setRows(d.giftCards); setTotal(d.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [token, page, search, status]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const toggleStatus = async (id: number, current: string) => {
    const action = current === "ACTIVE" ? "deactivate" : "activate";
    await fetch(`${API}/admin/gift-cards/${id}/${action}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
    fetchCards();
  };

  const viewRedemptions = async (id: number) => {
    setViewId(id);
    const res = await fetch(`${API}/admin/gift-cards/${id}/redemptions`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await res.json();
    setRedemptions(d.redemptions || []);
  };

  const pages = Math.ceil(total / limit);

  return (
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gift Cards</h1>
          <p className="text-[13px] text-[#8fa0bb]">Manage gift cards and view redemptions</p>
        </div>
        <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Gift Card</Button>
      </div>

      <div className="flex gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b95ab]" />
          <input className="h-8 w-full rounded border border-[#3d4558] bg-[#0f1117] pl-8 pr-2 text-[13px] text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none"
            placeholder="Search code or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="h-8 rounded border border-[#3d4558] bg-[#0f1117] px-2 text-[13px] text-[#e8edf5]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All</option>
          <option value="ACTIVE">Active</option>
          <option value="REDEEMED">Redeemed</option>
          <option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-px rounded-md overflow-hidden border border-[#1e2638]">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[29px] rounded-none bg-[#181e2c]" />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[#1e2a40] bg-[#0c1018]" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
          <table className="w-full border-collapse text-left" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="border-b-2 border-[#2a2e3a]" style={{ backgroundColor: "#1e2128" }}>
                <th className={`${thBase} min-w-[130px]`}>Code</th>
                <th className={`${thBase} min-w-[160px]`}>Recipient</th>
                <th className={`${thBase} w-[90px] text-right`}>Initial</th>
                <th className={`${thBase} w-[90px] text-right`}>Balance</th>
                <th className={`${thBase} w-[110px]`}>Status</th>
                <th className={`${thBase} w-[90px]`}>Source</th>
                <th className={`${thBase} w-[100px]`}>Date</th>
                <th className={`${thBase} w-[90px] text-right border-r-0`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, idx) => (
                <tr key={c.id} className={`transition-colors duration-75 ${idx % 2 === 0 ? "bg-[#0c1018] hover:bg-[#111825]" : "bg-[#0f1520] hover:bg-[#141e2e]"}`}>
                  <td className={`${tableCell} font-mono text-[11px] text-[#dde4f0]`}>{c.code}</td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{c.recipientEmail ?? "—"}</td>
                  <td className={`${tableCell} text-right font-mono tabular-nums text-[#dde4f0]`}>${c.initialAmountUsd}</td>
                  <td className={`${tableCell} text-right font-mono tabular-nums font-semibold text-white`}>${c.balanceUsd}</td>
                  <td className={tableCell}>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[c.status] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>{c.status}</span>
                  </td>
                  <td className={`${tableCell} text-[#8fa0bb]`}>{c.isManual ? "Manual" : "Purchase"}</td>
                  <td className={`${tableCell} text-[#8fa0bb] whitespace-nowrap`}>{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className={`${tableCell} text-right border-r-0`}>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[#8fa0bb] hover:text-white hover:bg-[#1e2a40]" onClick={() => viewRedemptions(c.id)}><Eye className="h-4 w-4" /></Button>
                      {c.status === "ACTIVE" ? (
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-red-400 hover:text-red-200 hover:bg-red-500/10" onClick={() => toggleStatus(c.id, c.status)}><Ban className="h-4 w-4" /></Button>
                      ) : c.status === "DEACTIVATED" ? (
                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-500/10" onClick={() => toggleStatus(c.id, c.status)}><CheckCircle className="h-4 w-4" /></Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-[13px] text-[#4a5570]">No gift cards found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-[13px] text-[#9ca8bc]">
          <p className="text-[#8fa0bb]">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      <CreateGiftCardModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchCards} />
      <RedemptionsModal id={viewId} redemptions={redemptions} onClose={() => setViewId(null)} />
    </div>
  );
}

function CreateGiftCardModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [amount, setAmount] = useState("25");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const token = useAuthStore((s) => s.token);
  const handleCreate = async () => {
    setSubmitting(true);
    const res = await fetch(`${API}/admin/gift-cards`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, recipientEmail: email || undefined, recipientName: name || undefined }),
    });
    if (res.ok) { onCreated(); onClose(); setAmount("25"); setEmail(""); setName(""); }
    setSubmitting(false);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[#181c24] border-[#2e3340] text-[#dde4f0]">
        <DialogHeader><DialogTitle className="text-white">Create Gift Card</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8fa0bb] mb-1">Amount ($)</label>
            <input type="number" min="1" className="w-full rounded border border-[#3d4558] bg-[#0f1117] px-3 py-2 text-sm text-[#e8edf5] focus:border-sky-500/60 focus:outline-none" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8fa0bb] mb-1">Recipient Email</label>
            <input className="w-full rounded border border-[#3d4558] bg-[#0f1117] px-3 py-2 text-sm text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#8fa0bb] mb-1">Recipient Name</label>
            <input className="w-full rounded border border-[#3d4558] bg-[#0f1117] px-3 py-2 text-sm text-[#e8edf5] placeholder:text-[#6b7280] focus:border-sky-500/60 focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5]" onClick={onClose}>Cancel</Button>
          <Button className="bg-sky-600 hover:bg-sky-700 text-white" onClick={handleCreate} disabled={submitting}>{submitting ? "Creating..." : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionsModal({ id, redemptions, onClose }: { id: number | null; redemptions: Redemption[]; onClose: () => void }) {
  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#181c24] border-[#2e3340] text-[#dde4f0]">
        <DialogHeader><DialogTitle className="text-white">Redemption History</DialogTitle></DialogHeader>
        {redemptions.length === 0 ? (
          <p className="text-sm text-[#8fa0bb] text-center py-4">No redemptions yet.</p>
        ) : (
          <div className="divide-y divide-[#2a2e3a] max-h-64 overflow-y-auto">
            {redemptions.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono text-[#dde4f0]">{r.orderNumber}</span>
                  <span className="text-[11px] text-[#8fa0bb] ml-2">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-semibold text-red-300">-${r.amountUsd}</span>
                  <span className="text-[11px] text-[#8fa0bb] ml-2">${r.balanceBefore} → ${r.balanceAfter}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
