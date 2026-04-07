import { useEffect, useState, useCallback } from "react";
import { Search, ChevronLeft, ChevronRight, Plus, Ban, CheckCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800", REDEEMED: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-gray-100 text-gray-600", DEACTIVATED: "bg-red-100 text-red-800",
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gift Cards</h1>
          <p className="text-muted-foreground">Manage gift cards and view redemptions</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create Gift Card</Button>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className="w-full rounded-md border px-9 py-2 text-sm" placeholder="Search code or email..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="ALL">All</option><option value="ACTIVE">Active</option>
          <option value="REDEEMED">Redeemed</option><option value="DEACTIVATED">Deactivated</option>
        </select>
      </div>
      <div className="rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Code</th>
            <th className="px-4 py-3 text-left font-medium">Recipient</th>
            <th className="px-4 py-3 text-right font-medium">Initial</th>
            <th className="px-4 py-3 text-right font-medium">Balance</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Source</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {loading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b"><td colSpan={8} className="p-4"><Skeleton className="h-8" /></td></tr>
            )) : rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3 text-xs">{c.recipientEmail ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">${c.initialAmountUsd}</td>
                <td className="px-4 py-3 text-right font-mono font-semibold">${c.balanceUsd}</td>
                <td className="px-4 py-3"><Badge variant="secondary" className={STATUS_COLORS[c.status]}>{c.status}</Badge></td>
                <td className="px-4 py-3 text-xs">{c.isManual ? "Manual" : "Purchase"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => viewRedemptions(c.id)}><Eye className="h-4 w-4" /></Button>
                    {c.status === "ACTIVE" ? (
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(c.id, c.status)}><Ban className="h-4 w-4 text-red-500" /></Button>
                    ) : c.status === "DEACTIVATED" ? (
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(c.id, c.status)}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No gift cards found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
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
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create Gift Card</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">Amount ($)</label><input type="number" min="1" className="w-full rounded-md border px-3 py-2 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">Recipient Email</label><input className="w-full rounded-md border px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" /></div>
          <div><label className="block text-sm font-medium mb-1">Recipient Name</label><input className="w-full rounded-md border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleCreate} disabled={submitting}>{submitting ? "Creating..." : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RedemptionsModal({ id, redemptions, onClose }: { id: number | null; redemptions: Redemption[]; onClose: () => void }) {
  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Redemption History</DialogTitle></DialogHeader>
        {redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No redemptions yet.</p>
        ) : (
          <div className="divide-y max-h-64 overflow-y-auto">
            {redemptions.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-sm">
                <div><span className="font-mono">{r.orderNumber}</span><span className="text-xs text-muted-foreground ml-2">{new Date(r.createdAt).toLocaleDateString()}</span></div>
                <div className="text-right"><span className="font-mono font-semibold">-${r.amountUsd}</span><span className="text-xs text-muted-foreground ml-2">${r.balanceBefore} → ${r.balanceAfter}</span></div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
