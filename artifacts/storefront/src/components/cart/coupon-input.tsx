import { useState } from "react";
import { Tag, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/hooks/use-toast";

const VALID_COUPONS: Record<string, { discount: number; label: string }> = {
  SAVE10: { discount: 10, label: "10% off" },
  WELCOME15: { discount: 15, label: "15% off" },
  PIXEL20: { discount: 20, label: "20% off" },
};

export function useCouponDiscount(): { pct: number; label: string } | null {
  const code = useCartStore((s) => s.couponCode);
  if (!code) return null;
  const coupon = VALID_COUPONS[code.toUpperCase()];
  return coupon ? { pct: coupon.discount, label: coupon.label } : null;
}

export function CouponInput() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const couponCode = useCartStore((s) => s.couponCode);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const { toast } = useToast();

  async function handleApply() {
    if (!code.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    setLoading(false);

    const coupon = VALID_COUPONS[code.trim().toUpperCase()];
    if (coupon) {
      setCoupon(code.trim().toUpperCase());
      toast({ title: "Coupon applied!", description: `${coupon.label} discount` });
      setCode("");
    } else {
      toast({
        title: "Invalid coupon",
        description: "This coupon code is not valid or has expired.",
        variant: "destructive",
      });
    }
  }

  if (couponCode) {
    const coupon = VALID_COUPONS[couponCode];
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
        <Tag className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 flex-1">
          {couponCode} — {coupon?.label ?? "Applied"}
        </span>
        <button
          onClick={() => setCoupon(null)}
          className="text-green-600 hover:text-green-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Coupon Code</label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter coupon code"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <Button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          variant="outline"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
    </div>
  );
}
