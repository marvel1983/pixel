import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Loader2, Plus } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface WalletTx {
  id: number;
  type: string;
  amountUsd: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

export function WalletTab() {
  const { token } = useAuthStore();
  const { toast } = useToast();
  const [balance, setBalance] = useState("0.00");
  const [totalDeposited, setTotalDeposited] = useState("0.00");
  const [totalSpent, setTotalSpent] = useState("0.00");
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState("");
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
        setBalance(d.balanceUsd);
        setTotalDeposited(d.totalDeposited);
        setTotalSpent(d.totalSpent);
      }
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, [token]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(topUpAmount);
    if (!amt || amt < 5 || amt > 500) {
      toast({ title: "Amount must be between $5 and $500", variant: "destructive" }); return;
    }
    setTopping(true);
    try {
      const res = await fetch(`${API}/wallet/topup`, {
        method: "POST", headers, credentials: "include",
        body: JSON.stringify({ amountUsd: amt, cardToken: "tok_simulated_success" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: `$${amt.toFixed(2)} added to wallet` });
      setTopUpAmount(""); setShowTopUp(false);
      loadData();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Top-up failed", variant: "destructive" });
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
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-3xl font-bold">${parseFloat(balance).toFixed(2)}</p>
              </div>
            </div>
            <Button onClick={() => setShowTopUp(!showTopUp)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Funds
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Total Deposited</p>
              <p className="font-medium text-green-600">${parseFloat(totalDeposited).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="font-medium text-orange-600">${parseFloat(totalSpent).toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showTopUp && (
        <Card>
          <CardHeader><CardTitle className="text-base">Add Funds</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleTopUp} className="flex gap-2">
              <Input type="number" min="5" max="500" step="0.01" placeholder="Amount ($5–$500)"
                value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="max-w-[200px]" />
              <Button type="submit" disabled={topping}>
                {topping ? <Loader2 className="h-4 w-4 animate-spin" /> : "Top Up"}
              </Button>
            </form>
            <div className="flex gap-2 mt-2">
              {[10, 25, 50, 100].map((v) => (
                <Button key={v} variant="outline" size="sm" onClick={() => setTopUpAmount(String(v))}>${v}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No transactions yet</p>
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
                      <p className="text-xs text-muted-foreground">Bal: ${parseFloat(tx.balanceAfter).toFixed(2)}</p>
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
