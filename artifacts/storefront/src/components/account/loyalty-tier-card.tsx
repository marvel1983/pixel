import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency-store";

export interface AccountData {
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  tierMultiplier: number | string;
  currentTierThreshold: number;
  nextTier: string | null;
  nextTierThreshold: number | null;
  pointsToNextTier: number;
  discountValue: number;
  expiringPoints?: number;
  earliestExpiryDate?: string | null;
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-700 text-white border-amber-600",
  SILVER: "bg-slate-400 text-white border-slate-300",
  GOLD: "bg-yellow-500 text-white border-yellow-400",
  PLATINUM: "bg-violet-600 text-white border-violet-500",
};
const TIER_RING: Record<string, string> = {
  BRONZE: "ring-amber-700/30", SILVER: "ring-slate-400/30",
  GOLD: "ring-yellow-500/30", PLATINUM: "ring-violet-600/30",
};
const TIER_BG: Record<string, string> = {
  BRONZE: "from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20",
  SILVER: "from-slate-50 to-slate-100/60 dark:from-slate-950/30 dark:to-slate-900/20",
  GOLD: "from-yellow-50 to-yellow-100/60 dark:from-yellow-950/30 dark:to-yellow-900/20",
  PLATINUM: "from-violet-50 to-violet-100/60 dark:from-violet-950/30 dark:to-violet-900/20",
};
const TIER_PROGRESS: Record<string, string> = {
  BRONZE: "bg-amber-600", SILVER: "bg-slate-400", GOLD: "bg-yellow-500", PLATINUM: "bg-violet-600",
};
const TIER_ICONS: Record<string, string> = {
  BRONZE: "🥉", SILVER: "🥈", GOLD: "🥇", PLATINUM: "💎",
};

export function LoyaltyTierCard({ account, redemptionRate }: { account: AccountData; redemptionRate: number }) {
  const format = useCurrencyStore((s) => s.format);
  const tier = account.tier ?? "BRONZE";
  const bandRange = (account.nextTierThreshold ?? 1) - (account.currentTierThreshold ?? 0);
  const progressPct = account.nextTier
    ? Math.min(100, Math.max(0, ((account.lifetimePoints - (account.currentTierThreshold ?? 0)) / (bandRange || 1)) * 100))
    : 100;
  const worthDollars = account.pointsBalance * redemptionRate;

  return (
    <Card className={`border-2 ring-4 ${TIER_RING[tier] ?? "ring-primary/20"} bg-gradient-to-br ${TIER_BG[tier] ?? ""}`}>
      {(account.expiringPoints ?? 0) > 0 && (
        <div className="mx-6 mt-5 flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">{account.expiringPoints!.toLocaleString()} points</span> expiring
            {account.earliestExpiryDate ? ` on ${new Date(account.earliestExpiryDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}` : " soon"}.
            Redeem them before they expire!
          </p>
        </div>
      )}
      <CardContent className="pt-6 pb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`text-sm px-3 py-1 ${TIER_COLORS[tier] ?? "bg-gray-500 text-white"}`}>
                {TIER_ICONS[tier]} {tier}
              </Badge>
              <span className="text-xs text-muted-foreground">{account.tierMultiplier}x earn rate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold tabular-nums tracking-tight">{account.pointsBalance.toLocaleString()}</span>
              <span className="text-lg font-medium text-muted-foreground">pts</span>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">Worth {format(worthDollars)}</p>
          </div>
          <div className="flex-none text-center md:text-right">
            <div className="flex items-center justify-center md:justify-end gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{account.lifetimePoints.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground">Lifetime points earned</p>
          </div>
        </div>
        <div className="mt-6">
          {account.nextTier ? (
            <>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{tier}</span><span>{account.nextTier}</span>
              </div>
              <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${TIER_PROGRESS[tier] ?? "bg-primary"}`} style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-center">{account.pointsToNextTier.toLocaleString()} more points to {account.nextTier}</p>
            </>
          ) : (
            <>
              <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${TIER_PROGRESS[tier] ?? "bg-primary"}`} style={{ width: "100%" }} />
              </div>
              <p className="text-xs font-medium text-center mt-1.5 text-violet-600 dark:text-violet-400">💎 Maximum tier achieved</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
