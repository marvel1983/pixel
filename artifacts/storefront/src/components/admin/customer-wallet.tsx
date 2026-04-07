import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface WalletTx {
  id: number; type: string; amountUsd: string; balanceAfter: string;
  description: string | null; createdAt: string;
}
interface WalletData {
  wallet: { balanceUsd: string; totalDeposited: string; totalSpent: string };
  transactions: WalletTx[];
}

export function CustomerWallet({ userId }: { userId: number }) {
  const token = useAuthStore((s) => s.token);
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function load() {
    try {
      const res = await fetch(`${API}/admin/wallet/${userId}`, { headers });
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [userId]);

  async function adjust(type: "CREDIT" | "DEBIT") {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !reason.trim()) { alert("Enter valid amount and reason"); return; }
    setAdjusting(true);
    try {
      const res = await fetch(`${API}/admin/wallet/${userId}/adjust`, {
        method: "POST", headers,
        body: JSON.stringify({ type, amountUsd: amt, reason: reason.trim() }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error); return; }
      setAmount(""); setReason("");
      load();
    } catch { alert("Failed"); } finally { setAdjusting(false); }
  }

  if (loading) return <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;

  const balance = data?.wallet ? parseFloat(data.wallet.balanceUsd) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Wallet className="h-5 w-5 text-primary" />
        <span className="text-2xl font-bold">${balance.toFixed(2)}</span>
      </div>
      {data?.wallet && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Deposited: ${parseFloat(data.wallet.totalDeposited).toFixed(2)}</span>
          <span>Spent: ${parseFloat(data.wallet.totalSpent).toFixed(2)}</span>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Input type="number" min="0.01" step="0.01" placeholder="Amount" value={amount}
            onChange={(e) => setAmount(e.target.value)} className="h-8" />
          <Input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="default" onClick={() => adjust("CREDIT")} disabled={adjusting}>+Credit</Button>
          <Button size="sm" variant="outline" onClick={() => adjust("DEBIT")} disabled={adjusting}>-Debit</Button>
        </div>
      </div>
      {data?.transactions && data.transactions.length > 0 && (
        <div className="max-h-48 overflow-y-auto text-xs space-y-1 border rounded p-2">
          {data.transactions.slice(0, 20).map((tx) => {
            const isCredit = parseFloat(tx.amountUsd) > 0;
            return (
              <div key={tx.id} className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  {isCredit ? <ArrowDownCircle className="h-3 w-3 text-green-500" /> : <ArrowUpCircle className="h-3 w-3 text-orange-500" />}
                  <span className="truncate max-w-[200px]">{tx.description || tx.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={isCredit ? "text-green-600" : "text-orange-600"}>
                    {isCredit ? "+" : ""}${Math.abs(parseFloat(tx.amountUsd)).toFixed(2)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{new Date(tx.createdAt).toLocaleDateString()}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
