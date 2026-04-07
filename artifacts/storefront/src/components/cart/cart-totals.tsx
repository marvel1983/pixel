import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { CouponInput } from "./coupon-input";

export function CartTotals() {
  const { t } = useTranslation();
  const getTotal = useCartStore((s) => s.getTotal);
  const coupon = useCartStore((s) => s.coupon);
  const { format } = useCurrencyStore();

  const subtotal = getTotal();
  const discountAmount = coupon ? subtotal * (coupon.pct / 100) : 0;
  const total = subtotal - discountAmount;

  return (
    <div className="border rounded-lg p-5 space-y-4 bg-muted/10">
      <h3 className="text-lg font-bold">{t("cart.cartTotals")}</h3>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("cart.subtotal")}</span>
          <span className="font-medium">{format(subtotal)}</span>
        </div>

        {coupon && (
          <div className="flex justify-between text-sm text-green-600">
            <span>{t("cart.discount")} ({coupon.label})</span>
            <span>-{format(discountAmount)}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex justify-between text-base font-bold">
        <span>{t("cart.total")}</span>
        <span>{format(total)}</span>
      </div>

      <CouponInput />

      <Link href="/checkout">
        <Button size="lg" className="w-full">
          {t("cart.proceedToCheckout")}
        </Button>
      </Link>

      <p className="text-xs text-center text-muted-foreground">
        {t("cart.taxesNote")}
      </p>
    </div>
  );
}
