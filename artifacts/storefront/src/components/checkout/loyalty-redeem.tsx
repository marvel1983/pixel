import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface LoyaltyRedeemProps {
  subtotal: number;
  onRedeemChange: (points: number, discount: number) => void;
}

interface AccountInfo {
  pointsBalance: number;
  discountValue: number;
  tier: string;
}

/* ─── Custom loyalty star icon ──────────────────────────── */
function LoyaltyStarIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden="true">
      {/* outer glow ring */}
      <circle cx="24" cy="24" r="20" fill="#f59e0b" opacity="0.12" />
      <circle cx="24" cy="24" r="15" fill="#f59e0b" opacity="0.1" />
      {/* 5-point star */}
      <path
        d="M24 8l3.9 8.2 9 1.3-6.5 6.4 1.5 9-8-4.2-8 4.2 1.5-9-6.5-6.4 9-1.3z"
        fill="#f59e0b"
        stroke="#fbbf24"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.95"
      />
      {/* inner highlight on star */}
      <path
        d="M24 12l2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9z"
        fill="#fde68a"
        opacity="0.4"
      />
      {/* sparkles */}
      <line x1="24" y1="3" x2="24" y2="6" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <line x1="37" y1="10" x2="35" y2="12" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="44" y1="24" x2="41" y2="24" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

export function LoyaltyRedeem({ subtotal, onRedeemChange }: LoyaltyRedeemProps) {
  const token = useAuthStore((s) => s.token);
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [minRedeem, setMinRedeem] = useState(500);
  const [redemptionRate, setRedemptionRate] = useState(0.01);
  const [maxPct, setMaxPct] = useState(50);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const confRes = await fetch(`${API}/loyalty/config`);
        const conf = await confRes.json();
        if (!conf.enabled) { setLoading(false); return; }
        setEnabled(true);
        setMinRedeem(conf.minRedeemPoints);
        setRedemptionRate(parseFloat(conf.redemptionRate));
        setMaxPct(conf.maxRedeemPercent);
        if (isAuth()) {
          const accRes = await fetch(`${API}/loyalty/account`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          const acc = await accRes.json();
          if (acc.enabled) setAccount(acc);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [token, isAuth]);

  if (loading || !enabled || !account || account.pointsBalance < minRedeem) return null;

  const maxDiscount = subtotal * (maxPct / 100);
  const maxPoints = Math.min(account.pointsBalance, Math.ceil(maxDiscount / redemptionRate));
  const step = Math.max(1, Math.floor(maxPoints / 100));

  function handleChange(pts: number) {
    const clamped = Math.min(Math.max(0, pts), maxPoints);
    const effective = clamped > 0 && clamped < minRedeem ? 0 : clamped;
    setPointsToUse(clamped);
    const disc = Math.min(Math.round(effective * redemptionRate * 100) / 100, maxDiscount);
    setDiscount(disc);
    onRedeemChange(effective, disc);
  }

  function handleClear() {
    setPointsToUse(0);
    setDiscount(0);
    onRedeemChange(0, 0);
  }

  const pct = maxPoints > 0 ? Math.round((pointsToUse / maxPoints) * 100) : 0;
  const belowMin = pointsToUse > 0 && pointsToUse < minRedeem;

  return (
    <div
      className="relative rounded-xl overflow-hidden border h-full"
      style={{
        background: discount > 0
          ? "linear-gradient(135deg, #1a1000 0%, #2d1f00 60%, #1a1000 100%)"
          : "linear-gradient(135deg, #0f1629 0%, #1a243d 60%, #0f1629 100%)",
        borderColor: discount > 0 ? "#f59e0b55" : "#ffffff15",
      }}
    >
      {/* glow when active */}
      {discount > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 20% 50%, #f59e0b12, transparent)" }}
        />
      )}

      <div className="relative p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <LoyaltyStarIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Loyalty Points</p>
              <p className="text-[11px] text-white/50 mt-0.5">
                Redeem for discount
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-amber-400">
              {account.pointsBalance.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/40 uppercase tracking-wide">pts avail.</p>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-1.5">
          <Slider
            value={[pointsToUse]}
            onValueChange={([v]) => handleChange(v)}
            min={0}
            max={maxPoints}
            step={step}
            className="[&_[role=slider]]:bg-amber-400 [&_[role=slider]]:border-amber-500 [&_.relative>span:first-child]:bg-white/20 [&_[data-orientation=horizontal]>.bg-primary]:bg-amber-400"
          />
          <div className="flex justify-between text-[10px] text-white/30">
            <span>0</span>
            <span>{maxPoints.toLocaleString()} max</span>
          </div>
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={pointsToUse || ""}
            onChange={(e) => handleChange(parseInt(e.target.value) || 0)}
            min={0}
            max={maxPoints}
            className="w-24 h-8 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/30"
            placeholder="0"
          />
          <span className="text-xs text-white/40">pts</span>
          {pct > 0 && (
            <span className="text-[11px] text-amber-400/70 ml-1">{pct}% of max</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {discount > 0 && (
              <span className="text-sm font-bold text-green-400">−€{discount.toFixed(2)}</span>
            )}
            {pointsToUse > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={handleClear}
                className="h-7 text-xs text-white/40 hover:text-white hover:bg-white/10 border-0 px-2"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Validation message */}
        {belowMin && (
          <p className="text-[11px] text-amber-400/80">
            Minimum {minRedeem.toLocaleString()} points to redeem
          </p>
        )}
      </div>
    </div>
  );
}
