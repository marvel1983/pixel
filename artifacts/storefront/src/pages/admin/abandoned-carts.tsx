import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, TrendingUp, DollarSign, Mail, Loader2, Play, RefreshCcw, ChevronDown, ChevronUp } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Stats { total: number; active: number; recovered: number; recoveryRate: string; recoveredRevenue: string }

interface CartRow {
  id: number; email: string; status: string; cartTotal: string;
  emailsSent: number; couponCode: string | null; createdAt: string;
  recoveredAt: string | null; cartData: { items: { productName: string; quantity: number }[] };
}

interface EmailLog { id: number; emailNumber: number; subject: string; sentAt: string }

export default function AdminAbandonedCartsPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [carts, setCarts] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ACTIVE");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

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

  const toggleEmailLog = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setLogsLoading(true);
    try {
      const res = await fetch(`${API}/admin/abandoned-carts/${id}/emails`, { headers });
      const data = await res.json();
      setEmailLogs(data.emails || []);
    } catch { setEmailLogs([]); }
    finally { setLogsLoading(false); }
  };

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
          <button
            onClick={processNow}
            className="flex items-center gap-2 rounded border border-sky-500 bg-sky-600 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5" /> Process Now
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ShoppingCart, label: "Total Carts", value: stats.total },
            { icon: Mail, label: "Active", value: stats.active },
            { icon: TrendingUp, label: "Recovered", value: `${stats.recovered} (${stats.recoveryRate}%)` },
            { icon: DollarSign, label: "Revenue Recovered", value: `€${stats.recoveredRevenue}` },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
              <div className="pt-4 px-4 pb-3 flex items-center gap-3">
                <s.icon className="h-5 w-5 text-sky-400 shrink-0" />
                <div><p className="text-xs text-[#5a6a84]">{s.label}</p><p className="text-lg font-bold text-[#dde4f0]">{s.value}</p></div>
              </div>
            </div>
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
        <div className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
          <div className="py-12 text-center text-[#5a6a84]">No abandoned carts found</div>
        </div>
      ) : (
        <div className="space-y-2">
          {carts.map((c) => (
            <div key={c.id} className="rounded-lg border border-[#2e3340] bg-[#181c24]" style={{boxShadow:"0 2px 8px rgba(0,0,0,0.35)"}}>
              <div className="py-3 px-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#dde4f0]">{c.email}</span>
                      {statusBadge(c.status)}
                    </div>
                    <div className="flex gap-3 text-xs text-[#5a6a84] flex-wrap">
                      <span>Total: <strong className="text-[#dde4f0]">${c.cartTotal}</strong></span>
                      <span>Items: {c.cartData.items.length}</span>
                      <span>Emails: {c.emailsSent}/3</span>
                      {c.couponCode && <span>Coupon: <strong className="text-[#dde4f0]">{c.couponCode}</strong></span>}
                      <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      {c.recoveredAt && <span className="text-green-400">Recovered {new Date(c.recoveredAt).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-xs text-[#5a6a84] line-clamp-1">
                      {c.cartData.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {c.emailsSent > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => toggleEmailLog(c.id)}>
                        {expandedId === c.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span className="ml-1 text-xs">Emails</span>
                      </Button>
                    )}
                    {c.status === "ACTIVE" && c.emailsSent < 3 && (
                      <Button size="sm" variant="outline" onClick={() => sendNow(c.id)}>
                        <Mail className="h-3 w-3 mr-1" /> Send
                      </Button>
                    )}
                  </div>
                </div>
                {expandedId === c.id && (
                  <div className="border-t border-[#2a2e3a] pt-2 mt-1">
                    {logsLoading ? (
                      <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin" /></div>
                    ) : emailLogs.length === 0 ? (
                      <p className="text-xs text-[#5a6a84]">No emails sent yet</p>
                    ) : (
                      <div className="space-y-1">
                        {emailLogs.map((log) => (
                          <div key={log.id} className="flex items-center gap-3 text-xs">
                            <Badge variant="outline" className="text-[10px]">Email {log.emailNumber}</Badge>
                            <span className="text-[#5a6a84]">{log.subject}</span>
                            <span className="text-[#5a6a84] ml-auto">{new Date(log.sentAt).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
