import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { Wallet } from "lucide-react";

interface Props {
  orderTotal: number;
  onWalletChange: (amount: number) => void;
}

export function WalletPayment({ orderTotal, onWalletChange }: Props) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const { balance: bal, loading, loadFailed, refresh } = useWalletBalance();
  const balance = bal ?? 0;
  const [useWallet, setUseWallet] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [usePartial, setUsePartial] = useState(false);

  useEffect(() => {
    void refresh();
  }, [orderTotal, refresh]);

  useEffect(() => {
    if (!useWallet) { onWalletChange(0); return; }
    if (usePartial) {
      const amt = Math.min(parseFloat(customAmount) || 0, balance, orderTotal);
      onWalletChange(Math.max(0, amt));
    } else {
      onWalletChange(Math.min(balance, orderTotal));
    }
  }, [useWallet, usePartial, customAmount, balance, orderTotal, onWalletChange]);

  if (!isAuthenticated() || loading) return null;
  if (loadFailed && bal === null) {
    return (
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-destructive">{t("wallet.dataLoadFailed")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            {t("wallet.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (balance <= 0) return null;

  const showStaleWarning = loadFailed && bal !== null;

  const walletApplied = useWallet
    ? usePartial
      ? Math.min(parseFloat(customAmount) || 0, balance, orderTotal)
      : Math.min(balance, orderTotal)
    : 0;
  const coversAll = walletApplied >= orderTotal - 0.01;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        {showStaleWarning && (
          <div
            className="mb-3 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:text-amber-100"
            role="status"
          >
            <span>{t("checkout.walletStaleBalanceWarning")}</span>
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 border-amber-600/50" onClick={() => void refresh()}>
              {t("wallet.retry")}
            </Button>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Wallet className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{t("checkout.walletPayTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {t("checkout.walletBalanceLabel", { amount: balance.toFixed(2) })}
              </p>
              <Link href="/account/balance" className="text-xs text-primary hover:underline">
                {t("checkout.walletManageBalanceLink")}
              </Link>
            </div>
          </div>
          <Switch checked={useWallet} onCheckedChange={setUseWallet} className="shrink-0" />
        </div>
        {useWallet && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={!usePartial} onChange={() => setUsePartial(false)} />
                {t("checkout.walletUseFull", { amount: Math.min(balance, orderTotal).toFixed(2) })}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={usePartial} onChange={() => setUsePartial(true)} />
                {t("checkout.walletCustomAmount")}
              </label>
              {usePartial && (
                <Input type="number" min="0.01" max={Math.min(balance, orderTotal)}
                  step="0.01" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-28 h-8" placeholder="€0.00" />
              )}
            </div>
            {walletApplied > 0 && (
              <p className="text-sm text-green-600 font-medium mt-1">
                {t("checkout.walletApplied", { amount: walletApplied.toFixed(2) })}
                {coversAll ? ` ${t("checkout.walletCoversFull")}` : ""}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
