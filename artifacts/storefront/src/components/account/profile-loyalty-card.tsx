import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export function ProfileLoyaltyCard() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLoyalty() {
      try {
        const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
        const res = await fetch(`${baseUrl}/loyalty/account`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          if (d.enabled) { setPoints(d.pointsBalance); setTier(d.tier); }
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    loadLoyalty();
  }, [token]);

  if (!loading && points === null) return null;

  return (
    <Card className="mb-4 border-primary/15 bg-muted/30">
      <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("accountPage.loyaltyTitle", { defaultValue: "Loyalty Rewards" })}</p>
            {loading ? (
              <p className="text-2xl font-bold tabular-nums">…</p>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {(points ?? 0).toLocaleString()} <span className="text-base font-normal text-muted-foreground">pts</span>
                </p>
                {tier && <p className="text-xs text-muted-foreground mt-0.5">{tier} tier</p>}
              </>
            )}
          </div>
        </div>
        <Link href="/account/loyalty">
          <Button variant="secondary" className="w-full sm:w-auto">View Rewards</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
