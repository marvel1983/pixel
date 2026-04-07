import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useAuthStore } from "@/stores/auth-store";
import { Star, Loader2 } from "lucide-react";

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
  const maxPointsByBalance = account.pointsBalance;
  const maxPointsByDiscount = Math.ceil(maxDiscount / redemptionRate);
  const maxPoints = Math.min(maxPointsByBalance, maxPointsByDiscount);

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

  return (
    <Card className="border-yellow-200 bg-yellow-50/50">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Use Loyalty Points</span>
          </div>
          <span className="text-sm text-muted-foreground">
            Balance: {account.pointsBalance.toLocaleString()} pts
          </span>
        </div>

        <Slider
          value={[pointsToUse]}
          onValueChange={([v]) => handleChange(v)}
          min={0}
          max={maxPoints}
          step={Math.max(1, Math.floor(maxPoints / 100))}
        />

        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={pointsToUse || ""}
            onChange={(e) => handleChange(parseInt(e.target.value) || 0)}
            className="w-28 h-8 text-sm"
            min={0}
            max={maxPoints}
          />
          <span className="text-sm text-muted-foreground">pts</span>
          {pointsToUse > 0 && (
            <>
              <span className="text-sm font-medium text-green-600 ml-auto">
                -${discount.toFixed(2)}
              </span>
              <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 text-xs">
                Clear
              </Button>
            </>
          )}
        </div>

        {pointsToUse > 0 && pointsToUse < minRedeem && (
          <p className="text-xs text-red-600">Minimum {minRedeem} points to redeem</p>
        )}
      </CardContent>
    </Card>
  );
}
