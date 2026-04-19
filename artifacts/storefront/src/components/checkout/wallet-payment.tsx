import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import { useWalletBalance } from "@/hooks/use-wallet-balance";

/* ─── Custom wallet icon ────────────────────────────────── */
function WalletIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden="true">
      {/* body */}
      <rect x="4" y="14" width="40" height="26" rx="5" fill="#fbbf24" opacity="0.15" />
      <rect x="4" y="14" width="40" height="26" rx="5" stroke="#fbbf24" strokeWidth="2.2" />
      {/* flap */}
      <path d="M4 20h40" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
      {/* coin pocket */}
      <rect x="30" y="24" width="11" height="9" rx="3" fill="#fbbf24" opacity="0.25" stroke="#fbbf24" strokeWidth="1.8" />
      {/* coin inside pocket */}
      <circle cx="35.5" cy="28.5" r="2.5" fill="#fbbf24" opacity="0.7" />
      {/* card slot lines */}
      <line x1="10" y1="27" x2="22" y2="27" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      <line x1="10" y1="31" x2="18" y2="31" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" opacity="0.35" />
      {/* strap at top */}
      <path d="M12 14V11a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v3" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

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

  useEffect(() => { void refresh(); }, [orderTotal, refresh]);

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
      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center justify-between gap-2">
        <p className="text-sm text-amber-800 dark:text-amber-200">{t("wallet.dataLoadFailed")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          {t("wallet.retry")}
        </Button>
      </div>
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
    <div
      className="relative rounded-xl overflow-hidden border transition-all duration-200"
      style={{
        background: useWallet
          ? "linear-gradient(135deg, #1a1000 0%, #2d1f00 60%, #1a1000 100%)"
          : "linear-gradient(135deg, #0f1629 0%, #1a243d 60%, #0f1629 100%)",
        borderColor: useWallet ? "#f59e0b55" : "#ffffff15",
      }}
    >
      {/* Glow when active */}
      {useWallet && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 20% 50%, #f59e0b15, transparent)" }} />
      )}

      <div className="relative p-4">
        {showStaleWarning && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-center justify-between gap-2">
            <span>{t("checkout.walletStaleBalanceWarning")}</span>
            <Button type="button" variant="outline" size="sm" className="h-7 border-amber-500/40 text-amber-300 text-xs" onClick={() => void refresh()}>
              {t("wallet.retry")}
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Icon */}
            <div className="w-10 h-10 shrink-0">
              <WalletIcon />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{t("checkout.walletPayTitle")}</p>
              <p className="text-xs text-white/50 mt-0.5">
                {t("checkout.walletBalanceLabel", { amount: "" })}
                <span className="text-amber-400 font-bold ml-1">€{balance.toFixed(2)}</span>
              </p>
              <Link href="/account/balance" className="text-[11px] text-amber-400/70 hover:text-amber-400 transition-colors">
                {t("checkout.walletManageBalanceLink")}
              </Link>
            </div>
          </div>
          <Switch
            checked={useWallet}
            onCheckedChange={setUseWallet}
            className="shrink-0 data-[state=checked]:bg-amber-500"
          />
        </div>

        {useWallet && (
          <div className="mt-4 space-y-2 pt-3 border-t border-white/10">
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input type="radio" checked={!usePartial} onChange={() => setUsePartial(false)} className="accent-amber-400" />
              {t("checkout.walletUseFull", { amount: Math.min(balance, orderTotal).toFixed(2) })}
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input type="radio" checked={usePartial} onChange={() => setUsePartial(true)} className="accent-amber-400" />
                {t("checkout.walletCustomAmount")}
              </label>
              {usePartial && (
                <Input
                  type="number" min="0.01" max={Math.min(balance, orderTotal)} step="0.01"
                  value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-28 h-8 bg-white/10 border-white/20 text-white placeholder:text-white/30 text-sm"
                  placeholder="€0.00"
                />
              )}
            </div>
            {walletApplied > 0 && (
              <p className="text-sm text-amber-400 font-semibold">
                ✓ €{walletApplied.toFixed(2)} applied
                {coversAll && <span className="text-amber-300/70 font-normal ml-1">— covers full order</span>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
