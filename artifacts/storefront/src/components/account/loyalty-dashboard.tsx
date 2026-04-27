import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Trophy } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { LoyaltyTierCard, type AccountData } from "./loyalty-tier-card";
import { LoyaltyTransactionHistory, type Transaction, PAGE_SIZE } from "./loyalty-transactions";
import { ReferralSection, LoyaltyEarnSection, type LoyaltyBonuses } from "./loyalty-referral";

const API = import.meta.env.VITE_API_URL ?? "/api";

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
  bonuses?: LoyaltyBonuses;
}

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

  useEffect(() => {
    async function load() {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const opts = { headers, credentials: "include" as const };
        const [accRes, cfgRes] = await Promise.all([
          fetch(`${API}/loyalty/account`, opts),
          fetch(`${API}/loyalty/config`),
        ]);
        if (accRes.ok) { const d = await accRes.json(); if (d.enabled) setAccount(d); }
        if (cfgRes.ok) { const d = await cfgRes.json(); if (d.enabled) setConfig(d); }
      } catch { /* ignore */ } finally { setAccountLoading(false); }
    }
    load();
  }, [token]);

  useEffect(() => {
    async function loadTx() {
      setTxLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (txFilter !== "ALL") params.set("type", txFilter);
        const res = await fetch(`${API}/loyalty/transactions?${params}`, { headers, credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          setTransactions(d.transactions ?? []);
          setTxTotal(d.total ?? (d.transactions?.length ?? 0));
        }
      } catch { /* ignore */ } finally { setTxLoading(false); }
    }
    loadTx();
  }, [token, page, txFilter]);

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

  const redemptionRate = config ? parseFloat(config.redemptionRate) : 0.01;
  const totalPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE));

  function handleFilterChange(value: string) { setTxFilter(value); setPage(1); }

  return (
    <div className="space-y-6">
      <LoyaltyTierCard account={account} redemptionRate={redemptionRate} />
      {config && <LoyaltyEarnSection pointsPerDollar={config.pointsPerDollar} bonuses={config.bonuses} />}
      <LoyaltyTransactionHistory
        transactions={transactions} txLoading={txLoading} txFilter={txFilter}
        page={page} totalPages={totalPages}
        onFilterChange={handleFilterChange} onPageChange={setPage}
      />
      <ReferralSection bonuses={config?.bonuses} />
      <p className="text-xs text-center text-muted-foreground">
        Manage your account settings in{" "}
        <Link href="/account" className="underline underline-offset-2 hover:text-foreground">My Account</Link>.
      </p>
    </div>
  );
}
