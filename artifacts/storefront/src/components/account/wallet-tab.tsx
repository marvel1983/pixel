import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Loader2, Plus, CreditCard, ExternalLink } from "lucide-react";
import { WalletTopUpForm } from "./wallet-topup-form";
import { uuidV4 } from "@/lib/uuid";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface WalletTx {
  id: number; type: string; amountUsd: string; balanceAfter: string;
  description: string | null; createdAt: string;
}

export function WalletTab() {
  const { t } = useTranslation();
  const [path] = useLocation();
  const { token } = useAuthStore();
  const format = useCurrencyStore((s) => s.format);
  const { toast } = useToast();
  const [balance, setBalance] = useState("0.00");
  const [totalDeposited, setTotalDeposited] = useState("0.00");
  const [totalSpent, setTotalSpent] = useState("0.00");
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTopUp, setShowTopUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const TX_LIMIT = 20;

  async function loadData() {
    setLoadError(false);
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API}/wallet/balance`, { headers, credentials: "include" }),
        fetch(`${API}/wallet/transactions?page=1&limit=${TX_LIMIT}`, { headers, credentials: "include" }),
      ]);
      let ok = true;
      if (balRes.ok) {
        const d = await balRes.json();
        setBalance(d.balanceUsd); setTotalDeposited(d.totalDeposited); setTotalSpent(d.totalSpent);
      } else { ok = false; }
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions);
        setTxPage(1);
        setTxTotal(typeof d.total === "number" ? d.total : d.transactions.length);
      } else { ok = false; }
      setLoadError(!ok);
    } catch {
      setLoadError(true);
    } finally { setLoading(false); }
  }

  async function loadMoreTransactions() {
    if (loadingMore || transactions.length >= txTotal) return;
    const next = txPage + 1;
    setLoadingMore(true);
    try {
      const txRes = await fetch(`${API}/wallet/transactions?page=${next}&limit=${TX_LIMIT}`, {
        headers, credentials: "include",
      });
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions((prev) => [...prev, ...d.transactions]);
        setTxPage(next);
        if (typeof d.total === "number") setTxTotal(d.total);
      }
    } catch {} finally { setLoadingMore(false); }
  }

  useEffect(() => { loadData(); }, [token]);

  // Handle return from Stripe Checkout after top-up
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("topup_session");
    if (!sessionId || !token) return;
    window.history.replaceState({}, "", window.location.pathname);
    fetch(`${API}/wallet/topup/confirm-session`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": uuidV4() },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.balanceUsd !== undefined) {
          toast({ title: "Wallet topped up successfully" });
          void loadData();
        } else {
          toast({ title: d.error ?? "Failed to confirm top-up", variant: "destructive" });
        }
      })
      .catch(() => toast({ title: "Failed to confirm top-up", variant: "destructive" }));
  }, [token]);

  async function createSession(amt: number) {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/wallet/topup/session`, {
        method: "POST", headers, credentials: "include",
        body: JSON.stringify({ amountUsd: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate payment");
      window.location.href = data.url;
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Top-up failed", variant: "destructive" });
      setSubmitting(false);
    }
  }

  if (loading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="text-sm text-destructive">{t("wallet.dataLoadFailed")}</p>
          <Button type="button" variant="outline" onClick={() => { setLoading(true); void loadData(); }}>
            {t("wallet.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasMoreTx = txTotal > transactions.length;
  const onDedicatedBalancePage = path.replace(/\/$/, "") === "/account/balance";

  return (
    <div className="space-y-4">
      {!onDedicatedBalancePage && (
        <p className="text-sm text-muted-foreground">
          <Link href="/account/balance" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
            {t("wallet.viewOnFullPage")}
          </Link>
        </p>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("wallet.availableBalance")}</p>
                <p className="text-3xl font-bold">{format(parseFloat(balance))}</p>
              </div>
            </div>
            {!showTopUp && (
              <Button onClick={() => setShowTopUp(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> {t("wallet.addFunds")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">{t("wallet.totalDeposited")}</p>
              <p className="font-medium text-green-600">{format(parseFloat(totalDeposited))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("wallet.totalSpent")}</p>
              <p className="font-medium text-orange-600">{format(parseFloat(totalSpent))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showTopUp && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> {t("wallet.addFunds")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WalletTopUpForm
              onSubmit={createSession}
              onCancel={() => setShowTopUp(false)}
              processing={submitting}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">{t("wallet.transactionHistory")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("wallet.noTransactions")}</p>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => {
                const isCredit = parseFloat(tx.amountUsd) > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      {isCredit
                        ? <ArrowDownCircle className="h-5 w-5 text-green-500" />
                        : <ArrowUpCircle className="h-5 w-5 text-orange-500" />}
                      <div>
                        <p className="text-sm font-medium">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${isCredit ? "text-green-600" : "text-orange-600"}`}>
                        {isCredit ? "+" : ""}{format(Math.abs(parseFloat(tx.amountUsd)))}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("wallet.balance", { amount: parseFloat(tx.balanceAfter).toFixed(2) })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {hasMoreTx && (
            <div className="p-4 border-t">
              <Button type="button" variant="outline" className="w-full" disabled={loadingMore}
                onClick={() => void loadMoreTransactions()}>
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {t("wallet.loadMore")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
