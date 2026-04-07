import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useAuthStore } from "@/stores/auth-store";
import { DollarSign, Link2, BarChart3, Shield, Clock, Users } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ProgramInfo {
  enabled: boolean;
  defaultCommissionRate?: string;
  minimumPayout?: string;
  cookieDurationDays?: number;
  programDescription?: string;
}

export default function AffiliatesPage() {
  const [info, setInfo] = useState<ProgramInfo | null>(null);
  const token = useAuthStore((s) => s.token);

  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/affiliate-settings/public`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setInfo)
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div className="max-w-5xl mx-auto px-4 py-8 text-center py-20">
      <h1 className="text-3xl font-bold mb-4">Affiliate Program</h1>
      <p className="text-muted-foreground">Unable to load program information. Please try again later.</p>
    </div>
  );

  if (!info) return <div className="max-w-5xl mx-auto px-4 py-8">Loading...</div>;
  if (!info.enabled) return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumbs crumbs={[{ label: "Affiliates" }]} />
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Affiliate Program</h1>
        <p className="text-muted-foreground">Our affiliate program is currently not available. Check back later!</p>
      </div>
    </div>
  );

  const features = [
    { icon: DollarSign, title: `${info.defaultCommissionRate}% Commission`, desc: "Earn on every sale you refer" },
    { icon: Clock, title: `${info.cookieDurationDays}-Day Cookie`, desc: "Extended tracking window" },
    { icon: BarChart3, title: "Real-Time Dashboard", desc: "Track clicks, sales & earnings" },
    { icon: Shield, title: "Trusted Program", desc: "Reliable payouts & support" },
    { icon: Link2, title: "Unique Referral Link", desc: "Share your personalized link" },
    { icon: Users, title: "No Limit", desc: "Unlimited earning potential" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <Breadcrumbs crumbs={[{ label: "Affiliates" }]} />

      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Join Our Affiliate Program</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Earn {info.defaultCommissionRate}% commission on every sale you refer. Share your unique link and start earning today.
        </p>
        <div className="pt-4">
          {token ? (
            <Link href="/affiliates/apply">
              <Button size="lg" className="px-8">Apply Now</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg" className="px-8">Login to Apply</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((f) => (
          <Card key={f.title}>
            <CardContent className="pt-6 text-center space-y-2">
              <f.icon className="h-8 w-8 mx-auto text-blue-600" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>How It Works</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Apply", desc: "Submit your application with details about how you'll promote" },
              { step: "2", title: "Share", desc: "Get your unique referral link and share it with your audience" },
              { step: "3", title: "Earn", desc: `Earn ${info.defaultCommissionRate}% on every sale. Min payout: $${info.minimumPayout}` },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mx-auto">{s.step}</div>
                <h4 className="font-semibold">{s.title}</h4>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {info.programDescription && (
        <Card>
          <CardHeader><CardTitle>Program Details</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{info.programDescription}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
