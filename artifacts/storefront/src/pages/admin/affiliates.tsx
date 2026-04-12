import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Search, Check, X, DollarSign, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Affiliate {
  profile: {
    id: number; referralCode: string; status: string; commissionRate: string;
    totalEarned: string; totalPaid: string; pendingBalance: string;
    totalClicks: number; totalOrders: number; websiteUrl: string | null;
    promotionMethod: string | null; createdAt: string; approvedAt: string | null;
  };
  email: string; firstName: string | null; lastName: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "border-emerald-500 bg-emerald-500/20 text-emerald-200",
  PENDING: "border-amber-500 bg-amber-500/20 text-amber-200",
  REJECTED: "border-red-500 bg-red-500/20 text-red-200",
  SUSPENDED: "border-red-600 bg-red-600/20 text-red-300",
};

export default function AdminAffiliatesPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pending");

  const statusMap: Record<string, string> = { pending: "PENDING", active: "APPROVED", all: "ALL" };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = statusMap[tab] || "ALL";
      const q = new URLSearchParams({ status: s, limit: "100" });
      if (search) q.set("search", search);
      const res = await fetch(`${API}/admin/affiliates?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load affiliates");
      const data = await res.json();
      setAffiliates(data.affiliates || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tab, search, token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${API}/admin/affiliates/${id}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast({ title: `Affiliate ${status.toLowerCase()}` });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const markPaid = async (id: number) => {
    const amount = prompt("Enter payout amount:");
    if (!amount) return;
    try {
      const res = await fetch(`${API}/admin/affiliates/${id}/mark-paid`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Payout Marked", description: `$${data.paidAmount} paid` });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const approveHeld = async () => {
    try {
      const res = await fetch(`${API}/admin/affiliates/approve-held`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `${data.approved} commissions approved` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3 text-[#e8edf5]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Affiliates</h1>
        <Button size="sm" variant="outline" className="border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38]" onClick={approveHeld}>Approve Held Commissions</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#1e2128] border border-[#2e3340]">
          <TabsTrigger value="pending" className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-[#d4a017]">Applications</TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-[#d4a017]">Active</TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-[#2a2e3a] data-[state=active]:text-[#d4a017]">All</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b95ab]" />
            <Input
              placeholder="Search by email, name, or code..."
              className="pl-8 h-8 border-[#3d4558] bg-[#0f1117] text-[#e8edf5] placeholder:text-[#6b7280] focus-visible:ring-sky-500/40 focus-visible:border-sky-500/60"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#8fa0bb]" /></div>
        ) : affiliates.length === 0 ? (
          <div className="mt-3 rounded-lg border border-[#2e3340] bg-[#181c24] p-12 text-center text-[13px] text-[#4a5570]">No affiliates found</div>
        ) : (
          <div className="space-y-2 mt-3">
            {affiliates.map((a) => (
              <div key={a.profile.id} className="rounded-lg border border-[#2e3340] bg-[#181c24] p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#dde4f0]">{a.firstName} {a.lastName}</span>
                      <span className="text-[12px] text-[#8fa0bb]">{a.email}</span>
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[a.profile.status] ?? "border-[#3d4558] bg-[#1a1f2e] text-[#c8d0e0]"}`}>
                        {a.profile.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[11px] text-[#8fa0bb]">
                      <span>Code: <strong className="text-[#dde4f0] font-mono">{a.profile.referralCode}</strong></span>
                      <span>Rate: <strong className="text-[#dde4f0]">{a.profile.commissionRate}%</strong></span>
                      <span>Clicks: <strong className="text-[#dde4f0]">{a.profile.totalClicks}</strong></span>
                      <span>Orders: <strong className="text-[#dde4f0]">{a.profile.totalOrders}</strong></span>
                      <span>Earned: <strong className="text-emerald-300">${a.profile.totalEarned}</strong></span>
                      <span>Paid: <strong className="text-sky-300">${a.profile.totalPaid}</strong></span>
                      {parseFloat(a.profile.pendingBalance) > 0 && (
                        <span>Pending: <strong className="text-amber-300">${a.profile.pendingBalance}</strong></span>
                      )}
                    </div>
                    {a.profile.promotionMethod && (
                      <p className="text-[11px] text-[#8fa0bb] line-clamp-1">Method: {a.profile.promotionMethod}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {a.profile.status === "PENDING" && (
                      <>
                        <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]" onClick={() => updateStatus(a.profile.id, "APPROVED")}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[12px]" onClick={() => updateStatus(a.profile.id, "REJECTED")}><X className="h-3 w-3 mr-1" /> Reject</Button>
                      </>
                    )}
                    {a.profile.status === "APPROVED" && (
                      <>
                        <Button size="sm" variant="outline" className="h-7 border-[#3d4558] bg-[#1a1f2e] text-[#e8edf5] hover:bg-[#252a38] text-[12px]" onClick={() => markPaid(a.profile.id)}><DollarSign className="h-3 w-3 mr-1" /> Pay</Button>
                        <Button size="sm" variant="destructive" className="h-7 text-[12px]" onClick={() => updateStatus(a.profile.id, "SUSPENDED")}>Suspend</Button>
                      </>
                    )}
                    {a.profile.status === "SUSPENDED" && (
                      <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]" onClick={() => updateStatus(a.profile.id, "APPROVED")}>Reactivate</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}
