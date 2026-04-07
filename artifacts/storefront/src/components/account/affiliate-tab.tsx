import { useState, useEffect } from "react";
import { Link } from "wouter";
import QRCode from "react-qr-code";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Copy, DollarSign, MousePointer, ShoppingCart, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Commission {
  id: number;
  orderTotal: string;
  commissionRate: string;
  commissionAmount: string;
  status: string;
  createdAt: string;
}

interface Profile {
  id: number;
  referralCode: string;
  status: string;
  commissionRate: string;
  totalEarned: string;
  totalPaid: string;
  pendingBalance: string;
  totalClicks: number;
  totalOrders: number;
  createdAt: string;
}

export function AffiliateTab() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [minPayout, setMinPayout] = useState(25);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API}/account/affiliate`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch(`${API}/affiliate-settings/public`).then((r) => r.json()).catch(() => null),
    ]).then(([d, s]) => {
      setProfile(d.profile);
      setCommissions(d.commissions || []);
      if (s?.minimumPayout) setMinPayout(parseFloat(s.minimumPayout));
    }).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!profile) return (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <h3 className="text-lg font-semibold">Join Our Affiliate Program</h3>
        <p className="text-muted-foreground">Earn commissions by referring customers.</p>
        <Link href="/affiliates/apply"><Button>Apply Now</Button></Link>
      </CardContent>
    </Card>
  );

  if (profile.status === "PENDING") return (
    <Card><CardContent className="py-12 text-center">
      <Badge variant="secondary" className="mb-4">Pending Review</Badge>
      <h3 className="text-lg font-semibold">Application Under Review</h3>
      <p className="text-muted-foreground mt-2">We'll notify you once your application is reviewed.</p>
    </CardContent></Card>
  );

  if (profile.status === "REJECTED") return (
    <Card><CardContent className="py-12 text-center">
      <Badge variant="destructive" className="mb-4">Rejected</Badge>
      <h3 className="text-lg font-semibold">Application Not Approved</h3>
      <p className="text-muted-foreground mt-2">Contact support for more information.</p>
    </CardContent></Card>
  );

  const refUrl = `${window.location.origin}/?ref=${profile.referralCode}`;
  const available = parseFloat(profile.totalEarned) - parseFloat(profile.totalPaid);
  const statusColor: Record<string, string> = { HELD: "bg-yellow-100 text-yellow-800", APPROVED: "bg-green-100 text-green-800", PAID: "bg-blue-100 text-blue-800", REVERSED: "bg-red-100 text-red-800" };

  const copyLink = () => {
    navigator.clipboard.writeText(refUrl);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  const requestPayout = async () => {
    const res = await fetch(`${API}/account/affiliate/payout`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) toast({ title: "Error", description: data.error, variant: "destructive" });
    else toast({ title: "Payout Requested", description: data.message });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: MousePointer, label: "Total Clicks", value: profile.totalClicks },
          { icon: ShoppingCart, label: "Total Orders", value: profile.totalOrders },
          { icon: DollarSign, label: "Available", value: `$${available.toFixed(2)}` },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-4 flex items-center gap-3">
            <s.icon className="h-5 w-5 text-blue-600" />
            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-lg font-bold">{s.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your Referral Link</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">{refUrl}</code>
            <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-start gap-4">
            <div className="space-y-2 flex-1">
              <p className="text-xs text-muted-foreground">Code: <strong>{profile.referralCode}</strong> · Rate: {profile.commissionRate}%</p>
              <Button size="sm" onClick={requestPayout} disabled={available < minPayout}>
                Request Payout {available < minPayout && `(min $${minPayout})`}
              </Button>
            </div>
            <div className="bg-white p-2 rounded border">
              <QRCode value={refUrl} size={80} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Commission History</CardTitle></CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No commissions yet. Share your link to start earning!</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commissions.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <div>
                    <span className="font-medium">${c.commissionAmount}</span>
                    <span className="text-muted-foreground ml-2">({c.commissionRate}% of ${c.orderTotal})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] || "bg-gray-100"}`}>{c.status}</span>
                    <span className="text-muted-foreground text-xs">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
