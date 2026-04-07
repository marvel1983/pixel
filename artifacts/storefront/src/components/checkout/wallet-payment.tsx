import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { Wallet, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Props {
  orderTotal: number;
  onWalletChange: (amount: number) => void;
}

export function WalletPayment({ orderTotal, onWalletChange }: Props) {
  const { token, isAuthenticated } = useAuthStore();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [useWallet, setUseWallet] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [usePartial, setUsePartial] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { setLoading(false); return; }
    fetch(`${API}/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setBalance(parseFloat(d.balanceUsd) || 0))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!useWallet) { onWalletChange(0); return; }
    if (usePartial) {
      const amt = Math.min(parseFloat(customAmount) || 0, balance, orderTotal);
      onWalletChange(Math.max(0, amt));
    } else {
      onWalletChange(Math.min(balance, orderTotal));
    }
  }, [useWallet, usePartial, customAmount, balance, orderTotal]);

  if (!isAuthenticated() || loading) return null;
  if (balance <= 0) return null;

  const walletApplied = useWallet
    ? usePartial
      ? Math.min(parseFloat(customAmount) || 0, balance, orderTotal)
      : Math.min(balance, orderTotal)
    : 0;
  const coversAll = walletApplied >= orderTotal - 0.01;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Pay with Wallet</p>
              <p className="text-xs text-muted-foreground">
                Balance: ${balance.toFixed(2)}
              </p>
            </div>
          </div>
          <Switch checked={useWallet} onCheckedChange={setUseWallet} />
        </div>
        {useWallet && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={!usePartial} onChange={() => setUsePartial(false)} />
                Use full balance (${Math.min(balance, orderTotal).toFixed(2)})
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={usePartial} onChange={() => setUsePartial(true)} />
                Custom amount
              </label>
              {usePartial && (
                <Input type="number" min="0.01" max={Math.min(balance, orderTotal)}
                  step="0.01" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-28 h-8" placeholder="$0.00" />
              )}
            </div>
            {walletApplied > 0 && (
              <p className="text-sm text-green-600 font-medium mt-1">
                -${walletApplied.toFixed(2)} from wallet
                {coversAll ? " (covers full order)" : ""}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
