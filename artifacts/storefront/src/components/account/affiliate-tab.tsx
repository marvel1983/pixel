import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";
import { Copy, MousePointer, ShoppingCart, Wallet, ExternalLink, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Profile {
  referralCode: string; status: string; commissionRate: string;
  totalEarned: string; totalPaid: string; totalClicks: number; totalOrders: number;
}

export function AffiliateTab() {
  const token = useAuthStore((s) => s.token);
  const { format } = useCurrencyStore();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/account/affiliate`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setProfile(d.profile ?? null))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (!profile) return (
    <Card>
      <CardContent className="py-12 text-center space-y-4">
        <h3 className="text-lg font-semibold">Join Our Affiliate Program</h3>
        <p className="text-muted-foreground text-sm">Earn commissions by referring customers to PixelCodes.</p>
        <Link href="/affiliates/apply"><Button>Apply Now</Button></Link>
      </CardContent>
    </Card>
  );

  if (profile.status === "PENDING") return (
    <Card><CardContent className="py-12 text-center space-y-2">
      <Badge variant="secondary">Pending Review</Badge>
      <h3 className="text-lg font-semibold">Application Under Review</h3>
      <p className="text-muted-foreground text-sm">We'll notify you once your application is reviewed.</p>
    </CardContent></Card>
  );

  if (profile.status === "REJECTED") return (
    <Card><CardContent className="py-12 text-center space-y-2">
      <Badge variant="destructive">Not Approved</Badge>
      <h3 className="text-lg font-semibold">Application Rejected</h3>
      <p className="text-muted-foreground text-sm">Contact support for more information.</p>
    </CardContent></Card>
  );

  const refUrl = `${window.location.origin}/?ref=${profile.referralCode}`;
  const available = parseFloat(profile.totalEarned) - parseFloat(profile.totalPaid);

  const copyLink = () => {
    navigator.clipboard.writeText(refUrl);
    toast({ title: "Copied!", description: "Referral link copied to clipboard" });
  };

  return (
    <Card>
      <CardContent className="py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Affiliate Program</p>
            <p className="text-xs text-muted-foreground">Code: <strong>{profile.referralCode}</strong> · {profile.commissionRate}% per sale</p>
          </div>
          <Badge className="bg-green-600 text-white">Active</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { icon: MousePointer, label: "Clicks", value: profile.totalClicks },
            { icon: ShoppingCart, label: "Orders", value: profile.totalOrders },
            { icon: Wallet, label: "Available", value: format(available) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-muted/40 p-3">
              <s.icon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-base font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <code className="flex-1 bg-muted px-3 py-2 rounded text-xs truncate">{refUrl}</code>
          <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-4 w-4" /></Button>
        </div>

        <Link href="/account/affiliate">
          <Button className="w-full gap-2">
            <ExternalLink className="h-4 w-4" /> View Full Dashboard
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
