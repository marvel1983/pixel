import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, Trophy, TrendingUp, Star, Gift } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-700 text-white",
  SILVER: "bg-gray-400 text-white",
  GOLD: "bg-yellow-500 text-white",
  PLATINUM: "bg-violet-600 text-white",
};

const TIER_ICONS: Record<string, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  PLATINUM: "💎",
};

interface AccountData {
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  tierMultiplier: string;
  nextTier: string | null;
  nextTierThreshold: number | null;
  pointsToNextTier: number;
  discountValue: number;
}

interface Transaction {
  id: number;
  type: string;
  points: number;
  balance: number;
  description: string;
  createdAt: string;
}

export function RewardsTab() {
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const opts = { headers, credentials: "include" as const };
        const [accRes, txRes] = await Promise.all([
          fetch(`${API}/loyalty/account`, opts),
          fetch(`${API}/loyalty/transactions`, opts),
        ]);
        if (accRes.ok) {
          const d = await accRes.json();
          if (d.enabled) setAccount(d);
        }
        if (txRes.ok) {
          const d = await txRes.json();
          setTransactions(d.transactions ?? []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  if (!account) return <Card><CardContent className="py-12 text-center text-muted-foreground"><Trophy className="h-8 w-8 mx-auto mb-3" /><p>Loyalty rewards are not available yet.</p></CardContent></Card>;

  const currentThreshold = account.currentTierThreshold ?? 0;
  const nextThreshold = account.nextTierThreshold ?? 1;
  const bandRange = nextThreshold - currentThreshold;
  const progressPct = account.nextTier
    ? Math.min(100, Math.max(0, ((account.lifetimePoints - currentThreshold) / (bandRange || 1)) * 100))
    : 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Badge className={`text-sm px-3 py-1 mb-2 ${TIER_COLORS[account.tier] ?? "bg-gray-500 text-white"}`}>
              {TIER_ICONS[account.tier]} {account.tier}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">{account.tierMultiplier}x earn rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{account.pointsBalance.toLocaleString()}</span>
            </div>
            <p className="text-sm text-muted-foreground">Available Points</p>
            <p className="text-xs text-green-600 mt-1">Worth ${account.discountValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">{account.lifetimePoints.toLocaleString()}</span>
            </div>
            <p className="text-sm text-muted-foreground">Lifetime Points</p>
          </CardContent>
        </Card>
      </div>

      {account.nextTier && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between text-sm mb-2">
              <span>{account.tier}</span>
              <span>{account.nextTier}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {account.pointsToNextTier.toLocaleString()} more points to {account.nextTier}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gift className="h-5 w-5" /> Transaction History</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No transactions yet.</p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-sm font-semibold ${tx.points > 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.points > 0 ? "+" : ""}{tx.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
