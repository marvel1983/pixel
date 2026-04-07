import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingCart, XCircle, CheckCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export default function CartRecoverPage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const clearCart = useCartStore((s) => s.clearCart);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"loading" | "restored" | "error" | "unsubscribed" | "expired">("loading");

  useEffect(() => {
    if (!token) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "unsubscribe") {
      fetch(`${API}/cart/recover/${token}?action=unsubscribe`)
        .then((r) => r.json())
        .then((d) => setStatus(d.unsubscribed ? "unsubscribed" : "error"))
        .catch(() => setStatus("error"))
        .finally(() => setLoading(false));
      return;
    }

    (async () => {
      try {
        const r = await fetch(`${API}/cart/recover/${token}`);
        const data = await r.json();
        if (!data.cart) { setStatus("expired"); return; }

        clearCart();
        for (const item of data.cart.items) {
          addItem({
            variantId: item.variantId, productId: item.productId,
            productName: item.productName, variantName: item.variantName,
            priceUsd: item.priceUsd, imageUrl: item.imageUrl || null,
          });
          if (item.quantity > 1) updateQuantity(item.variantId, item.quantity);
        }

        if (data.cart.coupon) {
          try {
            const couponRes = await fetch(`${API}/coupons/validate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: data.cart.coupon }),
            });
            if (couponRes.ok) {
              const cd = await couponRes.json();
              setCoupon({ code: cd.code, pct: cd.discount, label: cd.label });
            }
          } catch {}
        }

        setStatus("restored");
        toast({ title: "Cart Restored!", description: "Your items have been added back to your cart." });
        setTimeout(() => setLocation("/cart"), 2000);
      } catch { setStatus("error"); }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-muted-foreground">Restoring your cart...</p>
      </div>
    );
  }

  const states = {
    restored: { icon: CheckCircle, color: "text-green-600", title: "Cart Restored!", desc: "Redirecting you to your cart...", action: () => setLocation("/cart"), btn: "Go to Cart" },
    unsubscribed: { icon: CheckCircle, color: "text-green-600", title: "Unsubscribed", desc: "You won't receive any more cart reminder emails.", action: () => setLocation("/"), btn: "Go to Homepage" },
    expired: { icon: XCircle, color: "text-amber-600", title: "Cart Expired", desc: "This cart recovery link has expired or was already used.", action: () => setLocation("/shop"), btn: "Browse Products" },
    error: { icon: XCircle, color: "text-red-600", title: "Something Went Wrong", desc: "We couldn't restore your cart. Please try again or browse our products.", action: () => setLocation("/shop"), btn: "Browse Products" },
  };

  const s = states[status as keyof typeof states] || states.error;
  const Icon = s.icon;

  return (
    <div className="max-w-lg mx-auto px-4 py-20">
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <Icon className={`h-12 w-12 mx-auto ${s.color}`} />
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <p className="text-muted-foreground">{s.desc}</p>
          <Button onClick={s.action}>{s.btn}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
