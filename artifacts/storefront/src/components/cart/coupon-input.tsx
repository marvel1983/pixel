import { useState } from "react";
import { Tag, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/hooks/use-toast";

interface CouponData {
  pct: number;
  label: string;
}

const couponCache = new Map<string, CouponData>();

export function useCouponDiscount(): CouponData | null {
  const code = useCartStore((s) => s.couponCode);
  if (!code) return null;
  return couponCache.get(code) ?? null;
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

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.valid) {
        const upperCode = data.code as string;
        couponCache.set(upperCode, { pct: data.discount, label: data.label });
        setCoupon(upperCode);
        toast({ title: "Coupon applied!", description: `${data.label} discount` });
        setCode("");
      } else {
        toast({
          title: "Invalid coupon",
          description: data.error ?? "This coupon code is not valid or has expired.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Could not validate coupon. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  if (couponCode) {
    const coupon = couponCache.get(couponCode);
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
