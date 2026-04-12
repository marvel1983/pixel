import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth-store";
import {
  Loader2,
  Trophy,
  TrendingUp,
  Star,
  Gift,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Users,
  Copy,
  CheckCheck,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  BRONZE: "bg-amber-700 text-white border-amber-600",
  SILVER: "bg-slate-400 text-white border-slate-300",
  GOLD: "bg-yellow-500 text-white border-yellow-400",
  PLATINUM: "bg-violet-600 text-white border-violet-500",
};

const TIER_RING: Record<string, string> = {
  BRONZE: "ring-amber-700/30",
  SILVER: "ring-slate-400/30",
  GOLD: "ring-yellow-500/30",
  PLATINUM: "ring-violet-600/30",
};

const TIER_BG: Record<string, string> = {
  BRONZE: "from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20",
  SILVER: "from-slate-50 to-slate-100/60 dark:from-slate-950/30 dark:to-slate-900/20",
  GOLD: "from-yellow-50 to-yellow-100/60 dark:from-yellow-950/30 dark:to-yellow-900/20",
  PLATINUM: "from-violet-50 to-violet-100/60 dark:from-violet-950/30 dark:to-violet-900/20",
};

const TIER_PROGRESS: Record<string, string> = {
  BRONZE: "bg-amber-600",
  SILVER: "bg-slate-400",
  GOLD: "bg-yellow-500",
  PLATINUM: "bg-violet-600",
};

const TIER_ICONS: Record<string, string> = {
  BRONZE: "🥉",
  SILVER: "🥈",
  GOLD: "🥇",
  PLATINUM: "💎",
};

const TX_TYPE_ICONS: Record<string, string> = {
  EARN: "⬆️",
  REDEEM: "⬇️",
  EXPIRE: "❌",
  EXPIRED: "❌",
  ADMIN: "⚙️",
  ADJUST: "⚙️",
  REFUND: "🔄",
};

const TX_FILTER_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Earned", value: "EARN" },
  { label: "Redeemed", value: "REDEEM" },
  { label: "Expired", value: "EXPIRE" },
  { label: "Adjusted", value: "ADMIN" },
];

const PAGE_SIZE = 20;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountData {
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

interface Transaction {
  id: number;
  type: string;
  points: number;
  balanceAfter?: number;
  balance?: number;
  description: string;
  createdAt: string;
  orderId?: number | null;
}

interface LoyaltyConfig {
  enabled: boolean;
  pointsPerDollar: number;
  redemptionRate: string;
  minRedeemPoints?: number;
  tiers?: {
    BRONZE: { threshold: number; multiplier: string };
    SILVER: { threshold: number; multiplier: string };
    GOLD: { threshold: number; multiplier: string };
    PLATINUM: { threshold: number; multiplier: string };
  };
  bonuses?: {
    welcome?: number;
    review?: number;
    birthday?: number;
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-3 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-3.5 w-48 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
      <div className="h-4 w-12 bg-muted rounded" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LoyaltyDashboard() {
  const token = useAuthStore((s) => s.token);

  const [accountLoading, setAccountLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [txFilter, setTxFilter] = useState("ALL");

  // Load account + config on mount
  useEffect(() => {
    async function loadAccountAndConfig() {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const opts = { headers, credentials: "include" as const };

        const [accRes, cfgRes] = await Promise.all([
          fetch(`${API}/loyalty/account`, opts),
          fetch(`${API}/loyalty/config`),
        ]);

        if (accRes.ok) {
          const d = await accRes.json();
          if (d.enabled) setAccount(d);
        }
        if (cfgRes.ok) {
          const d = await cfgRes.json();
          if (d.enabled) setConfig(d);
        }
      } catch {
        // ignore
      } finally {
        setAccountLoading(false);
      }
    }
    loadAccountAndConfig();
  }, [token]);

  // Load transactions when page or filter changes
  useEffect(() => {
    async function loadTx() {
      setTxLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (txFilter !== "ALL") params.set("type", txFilter);

        const res = await fetch(`${API}/loyalty/transactions?${params}`, {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          setTransactions(d.transactions ?? []);
          setTxTotal(d.total ?? (d.transactions?.length ?? 0));
        }
      } catch {
        // ignore
      } finally {
        setTxLoading(false);
      }
    }
    loadTx();
  }, [token, page, txFilter]);

  // ── Loading state ──
  if (accountLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Loading your loyalty rewards…</p>
        </CardContent>
      </Card>
    );
  }

  // ── Not enrolled / disabled state ──
  if (!account) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Loyalty rewards are not available yet.</p>
          <p className="text-sm mt-1">Check back later or contact support.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Computed values ──
  const tier = account.tier ?? "BRONZE";
  const currentThreshold = account.currentTierThreshold ?? 0;
  const nextThreshold = account.nextTierThreshold ?? 1;
  const bandRange = nextThreshold - currentThreshold;
  const progressPct = account.nextTier
    ? Math.min(100, Math.max(0, ((account.lifetimePoints - currentThreshold) / (bandRange || 1)) * 100))
    : 100;

  const redemptionRate = config ? parseFloat(config.redemptionRate) : 0.01;
  const worthDollars = account.pointsBalance * redemptionRate;
  const totalPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE));

  function handleFilterChange(value: string) {
    setTxFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* ── Section 1: Balance & Tier Card ── */}
      <Card className={`border-2 ring-4 ${TIER_RING[tier] ?? "ring-primary/20"} bg-gradient-to-br ${TIER_BG[tier] ?? ""}`}>
        {/* Expiry warning */}
        {account.expiringPoints != null && account.expiringPoints > 0 && (
          <div className="mx-6 mt-5 flex items-start gap-2 rounded-md border border-amber-400/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              <span className="font-semibold">{account.expiringPoints.toLocaleString()} points</span> expiring
              {account.earliestExpiryDate
                ? ` on ${new Date(account.earliestExpiryDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                : " soon"}
              . Redeem them before they expire!
            </p>
          </div>
        )}

        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Points display */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Badge className={`text-sm px-3 py-1 ${TIER_COLORS[tier] ?? "bg-gray-500 text-white"}`}>
                  {TIER_ICONS[tier]} {tier}
                </Badge>
                <span className="text-xs text-muted-foreground">{account.tierMultiplier}x earn rate</span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tabular-nums tracking-tight">
                  {account.pointsBalance.toLocaleString()}
                </span>
                <span className="text-lg font-medium text-muted-foreground">pts</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">
                Worth ${worthDollars.toFixed(2)}
              </p>
            </div>

            {/* Lifetime */}
            <div className="flex-none text-center md:text-right">
              <div className="flex items-center justify-center md:justify-end gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{account.lifetimePoints.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">Lifetime points earned</p>
            </div>
          </div>

          {/* Tier progress bar */}
          <div className="mt-6">
            {account.nextTier ? (
              <>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{tier}</span>
                  <span>{account.nextTier}</span>
                </div>
                <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${TIER_PROGRESS[tier] ?? "bg-primary"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  {account.pointsToNextTier.toLocaleString()} more points to {account.nextTier}
                </p>
              </>
            ) : (
              <div className="h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${TIER_PROGRESS[tier] ?? "bg-primary"}`} style={{ width: "100%" }} />
              </div>
            )}
            {!account.nextTier && (
              <p className="text-xs font-medium text-center mt-1.5 text-violet-600 dark:text-violet-400">
                💎 Maximum tier achieved
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: How to Earn Guide ── */}
      {config && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              How to Earn Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <EarnCard
                icon="💳"
                title="Purchases"
                description={`Earn ${config.pointsPerDollar} pts per $1 spent`}
                active
              />
              <EarnCard
                icon="⭐"
                title="Write a review"
                description={config.bonuses?.review ? `+${config.bonuses.review} pts` : "+50 pts"}
                active
              />
              <EarnCard
                icon="🎁"
                title="Welcome bonus"
                description={config.bonuses?.welcome ? `+${config.bonuses.welcome} pts` : "+100 pts"}
                active
              />
              <EarnCard
                icon="🎂"
                title="Birthday bonus"
                description="Coming soon"
                muted
              />
              <EarnCard
                icon="👥"
                title="Referral"
                description="Coming soon"
                muted
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Transaction History ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Transaction History
            </CardTitle>
            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1">
              {TX_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleFilterChange(opt.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    txFilter === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {txLoading ? (
            <div className="divide-y">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Gift className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No transactions yet.</p>
              <p className="text-xs mt-1">Start shopping to earn your first points!</p>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => {
                const icon = TX_TYPE_ICONS[tx.type] ?? "•";
                const isPositive = tx.points > 0;
                const balanceAfter = tx.balanceAfter ?? tx.balance;
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-3">
                    <span className="text-xl w-7 shrink-0 text-center">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      {balanceAfter != null && (
                        <p className="text-xs text-muted-foreground">
                          Balance after: {balanceAfter.toLocaleString()} pts
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums shrink-0 ${
                        isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {tx.points.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <>
              <Separator className="mt-4 mb-3" />
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || txLoading}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || txLoading}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: Refer a Friend ── */}
      <ReferralSection config={config} />

      {/* ── Footer: link back to account ── */}
      <p className="text-xs text-center text-muted-foreground">
        Manage your account settings in{" "}
        <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
          My Account
        </Link>
        .
      </p>
    </div>
  );
}

// ─── ReferralSection component ───────────────────────────────────────────────

interface ReferralData {
  referralCode: string;
  referralCount: number;
}

function ReferralSection({ config }: { config: LoyaltyConfig | null }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch(`${API}/loyalty/referral`, { headers, credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setReferral(d);
      })
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
  const referralBonus = config?.bonuses?.birthday ?? 0; // fallback to showing config referral bonus

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-500" />
          Refer a Friend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {displayCode && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Your referral code</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border bg-muted/40 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-center">
                    {displayCode}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(displayCode)}
                    className="shrink-0"
                  >
                    {copied ? (
                      <CheckCheck className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  Share code: REF{user?.id ?? ""}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">{referral?.referralCount ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Friends referred</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold">
                  {config?.bonuses?.birthday ?? "?"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Bonus points per referral</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              You'll earn points when your referred friend makes their first purchase.
              Share your code via email, social media, or messaging apps!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── EarnCard helper ─────────────────────────────────────────────────────────

function EarnCard({
  icon,
  title,
  description,
  active,
  muted,
}: {
  icon: string;
  title: string;
  description: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        muted
          ? "border-dashed border-border opacity-60"
          : "border-border bg-muted/30 hover:bg-muted/50"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`text-sm font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}>{title}</p>
        <p className={`text-xs mt-0.5 ${muted ? "text-muted-foreground/70 italic" : "text-muted-foreground"}`}>
          {description}
        </p>
      </div>
    </div>
  );
}
