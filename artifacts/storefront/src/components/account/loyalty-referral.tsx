import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Star, Users, Copy, CheckCheck } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ReferralData { referralCode: string; referralCount: number }

export interface LoyaltyBonuses { welcome?: number; review?: number; birthday?: number }

export function ReferralSection({ bonuses }: { bonuses: LoyaltyBonuses | undefined }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    fetch(`${API}/loyalty/referral`, { headers, credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setReferral(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const displayCode = referral?.referralCode ?? (user?.id ? `REF${user.id}` : null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" /> Refer a Friend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            {displayCode && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Your referral code</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border bg-muted/40 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-center">{displayCode}</div>
                  <Button variant="outline" size="icon" onClick={() => handleCopy(displayCode)} className="shrink-0">
                    {copied ? <CheckCheck className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">Share code: REF{user?.id ?? ""}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{referral?.referralCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Friends referred</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{bonuses?.birthday ?? "?"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bonus points per referral</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              You'll earn points when your referred friend makes their first purchase. Share your code via email, social media, or messaging apps!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EarnCard({ icon, title, description, active, muted }: {
  icon: string; title: string; description: string; active?: boolean; muted?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${muted ? "border-dashed border-border opacity-60" : "border-border bg-muted/30 hover:bg-muted/50"}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-sm font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}>{title}</p>
        <p className={`text-xs mt-0.5 ${muted ? "text-muted-foreground/70 italic" : "text-muted-foreground"}`}>{description}</p>
      </div>
    </div>
  );
}

export function LoyaltyEarnSection({ pointsPerDollar, bonuses }: { pointsPerDollar: number; bonuses: LoyaltyBonuses | undefined }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-500" /> How to Earn Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <EarnCard icon="💳" title="Purchases" description={`Earn ${pointsPerDollar} pts per $1 spent`} active />
          <EarnCard icon="⭐" title="Write a review" description={bonuses?.review ? `+${bonuses.review} pts` : "+50 pts"} active />
          <EarnCard icon="🎁" title="Welcome bonus" description={bonuses?.welcome ? `+${bonuses.welcome} pts` : "+100 pts"} active />
          <EarnCard icon="🎂" title="Birthday bonus" description="Coming soon" muted />
          <EarnCard icon="👥" title="Referral" description="Coming soon" muted />
        </div>
      </CardContent>
    </Card>
  );
}
