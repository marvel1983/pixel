import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, MousePointer, ShoppingCart, TrendingUp, DollarSign, Clock, Loader2, Wallet } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Commission {
  id: number; orderTotal: string; commissionRate: string;
  commissionAmount: string; status: string; createdAt: string;
}
interface Profile {
  id: number; referralCode: string; status: string; commissionRate: string;
  totalEarned: string; totalPaid: string; pendingBalance: string;
  totalClicks: number; totalOrders: number; paypalEmail: string | null;
}

const STATUS_CLS: Record<string, string> = {
  HELD: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  PAID: "bg-blue-100 text-blue-800",
  REVERSED: "bg-red-100 text-red-800",
};

function EarningsChart({ commissions }: { commissions: Commission[] }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { label: d.toLocaleString("default", { month: "short" }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, amount: 0 };
  });
  for (const c of commissions) {
    if (c.status === "REVERSED") continue;
    const bucket = months.find((m) => m.key === c.createdAt.slice(0, 7));
    if (bucket) bucket.amount += parseFloat(c.commissionAmount);
  }
  const max = Math.max(...months.map((m) => m.amount), 0.01);
  const H = 64;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-3">Monthly Earnings — last 6 months</p>
      <svg viewBox={`0 0 ${months.length * 40} ${H + 22}`} className="w-full">
        {months.map((m, i) => {
          const barH = Math.max((m.amount / max) * H, m.amount > 0 ? 4 : 0);
          return (
            <g key={m.key} transform={`translate(${i * 40 + 2}, 0)`}>
              <rect x={6} y={H - barH} width={28} height={barH} rx={3} fill="hsl(208 74% 46% / 0.7)" />
              <text x={20} y={H + 14} textAnchor="middle" fill="currentColor" opacity={0.5} style={{ fontSize: 9 }}>{m.label}</text>
              {m.amount > 0 && <text x={20} y={H - barH - 4} textAnchor="middle" fill="currentColor" opacity={0.7} style={{ fontSize: 8 }}>${m.amount.toFixed(0)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AccountAffiliatePage() {
  const [, setLocation] = useLocation();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { format } = useCurrencyStore();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [minPayout, setMinPayout] = useState(25);
  const [loading, setLoading] = useState(true);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { setLocation("/login"); return; }
    Promise.all([
      fetch(`${API}/account/affiliate`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/affiliate-settings/public`).then((r) => r.json()).catch(() => null),
    ]).then(([d, s]) => {
      setProfile(d.profile ?? null);
      setCommissions(d.commissions ?? []);
      if (d.profile?.paypalEmail) setPaypalEmail(d.profile.paypalEmail);
      if (s?.minimumPayout) setMinPayout(parseFloat(s.minimumPayout));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!profile) return (
    <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-4">
      <h2 className="text-xl font-bold">Join Our Affiliate Program</h2>
      <p className="text-muted-foreground text-sm">Earn commissions by referring customers to PixelCodes.</p>
      <Link href="/affiliates/apply"><Button size="lg">Apply Now</Button></Link>
    </div>
  );

  if (profile.status !== "APPROVED") {
    const isPending = profile.status === "PENDING";
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center space-y-3">
        <Badge variant={isPending ? "secondary" : "destructive"}>{isPending ? "Under Review" : "Not Approved"}</Badge>
        <h2 className="text-xl font-bold">{isPending ? "Application Pending" : "Application Rejected"}</h2>
        <p className="text-muted-foreground text-sm">{isPending ? "We'll notify you once your application is reviewed." : "Please contact support for more information."}</p>
        <Link href="/account"><Button variant="outline">Back to Account</Button></Link>
      </div>
    );
  }

  const refUrl = `${window.location.origin}/?ref=${profile.referralCode}`;
  const available = parseFloat(profile.totalEarned) - parseFloat(profile.totalPaid);
  const convRate = profile.totalClicks > 0 ? ((profile.totalOrders / profile.totalClicks) * 100).toFixed(1) : "0.0";
  const payoutPct = Math.min((available / minPayout) * 100, 100);
  const filtered = filter === "ALL" ? commissions : commissions.filter((c) => c.status === filter);

  const statuses = ["ALL", "HELD", "APPROVED", "PAID", "REVERSED"];
  const stats = [
    { label: "Total Clicks", value: profile.totalClicks.toLocaleString(), icon: MousePointer },
    { label: "Total Orders", value: profile.totalOrders.toLocaleString(), icon: ShoppingCart },
    { label: "Conversion", value: `${convRate}%`, icon: TrendingUp },
    { label: "Total Earned", value: format(parseFloat(profile.totalEarned)), icon: DollarSign },
    { label: "Pending", value: format(parseFloat(profile.pendingBalance)), icon: Clock },
    { label: "Available", value: format(available), icon: Wallet },
  ];

  const copyLink = () => {
    navigator.clipboard.writeText(refUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  const requestPayout = async () => {
    const res = await fetch(`${API}/account/affiliate/payout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) toast({ title: "Cannot Request Payout", description: data.error, variant: "destructive" });
    else toast({ title: "Payout Requested", description: data.message });
  };

  const saveEmail = async () => {
    if (!paypalEmail.includes("@")) return;
    setSavingEmail(true);
    const res = await fetch(`${API}/account/affiliate`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ paypalEmail: paypalEmail.trim() }),
    });
    setSavingEmail(false);
    if (res.ok) toast({ title: "Saved", description: "PayPal email updated" });
    else toast({ title: "Error", description: "Could not save email", variant: "destructive" });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <Breadcrumbs crumbs={[{ label: "Account", href: "/account" }, { label: "Affiliate Dashboard" }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Code: <strong>{profile.referralCode}</strong> · {profile.commissionRate}% commission per sale</p>
        </div>
        <Badge className="bg-green-600 text-white text-sm px-3 py-1">Active</Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <s.icon className="h-4 w-4 text-muted-foreground mb-2" />
              <p className="text-xl font-bold leading-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-5 px-5 pb-4">
              <EarningsChart commissions={commissions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Commission History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1.5 flex-wrap mb-4">
                {statuses.map((s) => {
                  const count = s === "ALL" ? commissions.length : commissions.filter((c) => c.status === s).length;
                  return (
                    <button key={s} onClick={() => setFilter(s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                      {s} ({count})
                    </button>
                  );
                })}
              </div>
              {filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10">No commissions yet — share your link to start earning!</p>
              ) : (
                <div className="text-sm">
                  <div className="grid grid-cols-4 text-xs text-muted-foreground pb-2 border-b">
                    <span>Earned</span><span>Order Total</span><span>Status</span><span className="text-right">Date</span>
                  </div>
                  <div className="divide-y">
                    {filtered.map((c) => (
                      <div key={c.id} className="grid grid-cols-4 items-center py-2.5">
                        <span className="font-semibold">{format(parseFloat(c.commissionAmount))}</span>
                        <span className="text-muted-foreground">{format(parseFloat(c.orderTotal))}</span>
                        <span><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[c.status] ?? "bg-muted text-muted-foreground"}`}>{c.status}</span></span>
                        <span className="text-right text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Your Referral Link</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-xs truncate">{refUrl}</code>
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-center py-2">
                <div className="bg-white p-2 rounded-lg border">
                  <QRCode value={refUrl} size={108} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">Share the QR code on social or in print materials</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Payout</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Progress to minimum</span>
                  <span className="font-medium">{format(available)} / {format(minPayout)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${payoutPct}%` }} />
                </div>
              </div>
              <Button className="w-full" onClick={requestPayout} disabled={available < minPayout}>
                {available >= minPayout ? "Request Payout" : `Need ${format(minPayout - available)} more`}
              </Button>
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium">PayPal Email for Payouts</p>
                <div className="flex gap-2">
                  <Input className="text-xs h-8" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="your@paypal.com" />
                  <Button size="sm" className="h-8 px-3 shrink-0" onClick={saveEmail} disabled={savingEmail}>
                    {savingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Payouts processed manually within 5 business days of request.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
