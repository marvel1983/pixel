import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  const badgeVariant = (s: string) => {
    if (s === "APPROVED") return "default";
    if (s === "PENDING") return "secondary";
    if (s === "REJECTED" || s === "SUSPENDED") return "destructive";
    return "outline";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Affiliates</h1>
        <Button size="sm" variant="outline" onClick={approveHeld}>Approve Held Commissions</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Applications</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by email, name, or code..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : affiliates.length === 0 ? (
          <Card className="mt-3"><CardContent className="py-12 text-center text-muted-foreground">No affiliates found</CardContent></Card>
        ) : (
          <div className="space-y-2 mt-3">
            {affiliates.map((a) => (
              <Card key={a.profile.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.firstName} {a.lastName}</span>
                        <span className="text-sm text-muted-foreground">{a.email}</span>
                        <Badge variant={badgeVariant(a.profile.status)}>{a.profile.status}</Badge>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Code: <strong>{a.profile.referralCode}</strong></span>
                        <span>Rate: {a.profile.commissionRate}%</span>
                        <span>Clicks: {a.profile.totalClicks}</span>
                        <span>Orders: {a.profile.totalOrders}</span>
                        <span>Earned: ${a.profile.totalEarned}</span>
                        <span>Paid: ${a.profile.totalPaid}</span>
                      </div>
                      {a.profile.promotionMethod && (
                        <p className="text-xs text-muted-foreground line-clamp-1">Method: {a.profile.promotionMethod}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {a.profile.status === "PENDING" && (
                        <>
                          <Button size="sm" variant="default" onClick={() => updateStatus(a.profile.id, "APPROVED")}><Check className="h-3 w-3 mr-1" /> Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus(a.profile.id, "REJECTED")}><X className="h-3 w-3 mr-1" /> Reject</Button>
                        </>
                      )}
                      {a.profile.status === "APPROVED" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => markPaid(a.profile.id)}><DollarSign className="h-3 w-3 mr-1" /> Pay</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateStatus(a.profile.id, "SUSPENDED")}>Suspend</Button>
                        </>
                      )}
                      {a.profile.status === "SUSPENDED" && (
                        <Button size="sm" variant="default" onClick={() => updateStatus(a.profile.id, "APPROVED")}>Reactivate</Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Tabs>
    </div>
  );
}
