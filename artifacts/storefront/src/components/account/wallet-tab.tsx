import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Loader2, Plus, CreditCard } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface WalletTx {
  id: number; type: string; amountUsd: string; balanceAfter: string;
  description: string | null; createdAt: string;
}

export function WalletTab() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [balance, setBalance] = useState("0.00");
  const [totalDeposited, setTotalDeposited] = useState("0.00");
  const [totalSpent, setTotalSpent] = useState("0.00");
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [topping, setTopping] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function loadData() {
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API}/wallet/balance`, { headers, credentials: "include" }),
        fetch(`${API}/wallet/transactions`, { headers, credentials: "include" }),
      ]);
      if (balRes.ok) {
        const d = await balRes.json();
        setBalance(d.balanceUsd); setTotalDeposited(d.totalDeposited); setTotalSpent(d.totalSpent);
      }
      if (txRes.ok) { const d = await txRes.json(); setTransactions(d.transactions); }
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, [token]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(topUpAmount);
    if (!amt || amt < 5 || amt > 500) {
      toast({ title: t("wallet.amountRange"), variant: "destructive" }); return;
    }
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13 || digits.length > 19) {
      toast({ title: t("wallet.validCard"), variant: "destructive" }); return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      toast({ title: t("wallet.validExpiry"), variant: "destructive" }); return;
    }
    if (!/^\d{3,4}$/.test(cardCvc)) {
      toast({ title: t("wallet.validCvc"), variant: "destructive" }); return;
    }
    const cardToken = `tok_${digits.slice(-4)}_${Date.now()}`;
    setTopping(true);
    try {
      const res = await fetch(`${API}/wallet/topup`, {
        method: "POST", headers, credentials: "include",
        body: JSON.stringify({ amountUsd: amt, cardToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: t("wallet.topUpSuccess", { amount: amt.toFixed(2) }) });
      setTopUpAmount(""); setCardNumber(""); setCardExpiry(""); setCardCvc("");
      setShowTopUp(false);
      loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("wallet.topUpFailed"), variant: "destructive" });
    } finally { setTopping(false); }
  }

  if (loading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("wallet.availableBalance")}</p>
                <p className="text-3xl font-bold">${parseFloat(balance).toFixed(2)}</p>
              </div>
            </div>
            <Button onClick={() => setShowTopUp(!showTopUp)} className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("wallet.addFunds")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">{t("wallet.totalDeposited")}</p>
              <p className="font-medium text-green-600">${parseFloat(totalDeposited).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("wallet.totalSpent")}</p>
              <p className="font-medium text-orange-600">${parseFloat(totalSpent).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showTopUp && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> {t("wallet.addFunds")}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleTopUp} className="space-y-3">
              <div>
                <Label className="text-sm">{t("wallet.amount")}</Label>
                <Input type="number" min="5" max="500" step="0.01" placeholder={t("wallet.amountPlaceholder")}
                  value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} />
                <div className="flex gap-2 mt-2">
                  {[10, 25, 50, 100].map((v) => (
                    <Button key={v} type="button" variant="outline" size="sm" onClick={() => setTopUpAmount(String(v))}>${v}</Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm">{t("checkout.cardNumber")}</Label>
                <Input placeholder={t("checkout.cardNumberPlaceholder")} value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)} maxLength={19} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">{t("checkout.expiry")}</Label>
                  <Input placeholder={t("checkout.expiryPlaceholder")} value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)} maxLength={5} />
                </div>
                <div>
                  <Label className="text-sm">{t("checkout.cvc")}</Label>
                  <Input placeholder={t("checkout.cvcPlaceholder")} value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)} maxLength={4} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={topping}>
                {topping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {topping ? t("wallet.processing") : t("wallet.topUp", { amount: parseFloat(topUpAmount || "0").toFixed(2) })}
              </Button>
            </form>
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
                      {isCredit ? <ArrowDownCircle className="h-5 w-5 text-green-500" /> : <ArrowUpCircle className="h-5 w-5 text-orange-500" />}
                      <div>
                        <p className="text-sm font-medium">{tx.description || tx.type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${isCredit ? "text-green-600" : "text-orange-600"}`}>
                        {isCredit ? "+" : ""}${Math.abs(parseFloat(tx.amountUsd)).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("wallet.balance", { amount: parseFloat(tx.balanceAfter).toFixed(2) })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
