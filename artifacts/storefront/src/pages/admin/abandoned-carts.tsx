import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, TrendingUp, DollarSign, Mail, Loader2, Play, RefreshCcw } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Stats { total: number; active: number; recovered: number; recoveryRate: string; recoveredRevenue: string }

interface CartRow {
  id: number; email: string; status: string; cartTotal: string;
  emailsSent: number; couponCode: string | null; createdAt: string;
  recoveredAt: string | null; cartData: { items: { productName: string; quantity: number }[] };
}

export default function AdminAbandonedCartsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [carts, setCarts] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ACTIVE");

  const headers = { Authorization: `Bearer ${token}` };

  const loadStats = useCallback(() => {
    fetch(`${API}/admin/abandoned-carts/stats`, { headers }).then((r) => r.json()).then(setStats);
  }, [token]);

  const loadCarts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/abandoned-carts?status=${tab}&limit=50`, { headers });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setCarts(data.carts || []);
    } catch { toast({ title: "Error loading carts", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [tab, token]);

  useEffect(() => { loadStats(); loadCarts(); }, [loadStats, loadCarts]);

  const processNow = async () => {
    const res = await fetch(`${API}/admin/abandoned-carts/process`, { method: "POST", headers });
    const data = await res.json();
    toast({ title: `${data.sent} emails sent` });
    loadStats(); loadCarts();
  };

  const sendNow = async (id: number) => {
    const res = await fetch(`${API}/admin/abandoned-carts/${id}/send-now`, { method: "POST", headers });
    if (!res.ok) { const d = await res.json(); toast({ title: "Error", description: d.error, variant: "destructive" }); return; }
    toast({ title: "Email triggered" });
    loadCarts();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ACTIVE: "secondary", RECOVERED: "default", EXPIRED: "outline", UNSUBSCRIBED: "destructive",
    };
    return <Badge variant={map[s] || "outline"}>{s}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Abandoned Carts</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { loadStats(); loadCarts(); }}>
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={processNow}>
            <Play className="h-3.5 w-3.5 mr-1" /> Process Now
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ShoppingCart, label: "Total Carts", value: stats.total },
            { icon: Mail, label: "Active", value: stats.active },
            { icon: TrendingUp, label: "Recovered", value: `${stats.recovered} (${stats.recoveryRate}%)` },
            { icon: DollarSign, label: "Revenue Recovered", value: `$${stats.recoveredRevenue}` },
          ].map((s) => (
            <Card key={s.label}><CardContent className="pt-4 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-blue-600 shrink-0" />
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ACTIVE">Active</TabsTrigger>
          <TabsTrigger value="RECOVERED">Recovered</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : carts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No abandoned carts found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {carts.map((c) => (
            <Card key={c.id}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.email}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Total: <strong>${c.cartTotal}</strong></span>
                      <span>Items: {c.cartData.items.length}</span>
                      <span>Emails: {c.emailsSent}/3</span>
                      {c.couponCode && <span>Coupon: <strong>{c.couponCode}</strong></span>}
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      {c.recoveredAt && <span className="text-green-600">Recovered {new Date(c.recoveredAt).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {c.cartData.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                    </p>
                  </div>
                  {c.status === "ACTIVE" && c.emailsSent < 3 && (
                    <Button size="sm" variant="outline" onClick={() => sendNow(c.id)}>
                      <Mail className="h-3 w-3 mr-1" /> Send Email
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
