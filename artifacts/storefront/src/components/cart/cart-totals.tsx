import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Lock, Zap, ArrowRight, Tag, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useAuthStore } from "@/stores/auth-store";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { CouponInput } from "./coupon-input";

export function CartTotals() {
  const { t } = useTranslation();
  const authed = useAuthStore((s) => Boolean(s.token && s.user));
  const { balance, loading: walletLoading, loadFailed, refresh } = useWalletBalance();
  const getTotal = useCartStore((s) => s.getTotal);
  const coupon = useCartStore((s) => s.coupon);
  const itemCount = useCartStore((s) => s.getItemCount());
  const { format } = useCurrencyStore();

  const subtotal = getTotal();
  const discountAmount = coupon ? subtotal * (coupon.pct / 100) : 0;
  const total = subtotal - discountAmount;

  return (
    <div className="space-y-3">
      {/* Summary card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-base text-foreground">Order Summary</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{itemCount} {itemCount === 1 ? "item" : "items"}</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Line items */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("cart.subtotal")}</span>
            <span className="font-medium">{format(subtotal)}</span>
          </div>

          {coupon && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1.5 text-green-600">
                <Tag className="h-3.5 w-3.5" />
                {coupon.code} ({coupon.label})
              </span>
              <span className="font-semibold text-green-600">−{format(discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Taxes & fees</span>
            <span>Calculated at checkout</span>
          </div>

          {authed && !walletLoading && balance !== null && !loadFailed && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4 shrink-0 text-primary" />
                <span>{t("cart.storeCreditAvailable", { amount: balance.toFixed(2) })}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{t("cart.storeCreditCheckoutOnly")}</p>
              <Link href="/account/balance" className="text-xs font-medium text-primary hover:underline mt-1 inline-block">
                {t("cart.storeCreditManage")}
              </Link>
            </div>
          )}
          {authed && !walletLoading && loadFailed && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
              <p className="text-destructive">{t("wallet.dataLoadFailed")}</p>
              <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => void refresh()}>
                {t("wallet.retry")}
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex justify-between items-baseline">
            <span className="font-bold text-base">{t("cart.total")}</span>
            <div className="text-right">
              <span className="font-extrabold text-xl text-foreground">{format(total)}</span>
              <p className="text-[10px] text-muted-foreground">EUR</p>
            </div>
          </div>

          {/* Coupon input */}
          <CouponInput />

          {/* Checkout button */}
          <Link href="/checkout">
            <Button size="lg" className="w-full gap-2 mt-1 font-semibold">
              {t("cart.proceedToCheckout")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <p className="text-[11px] text-center text-muted-foreground">
            {t("cart.taxesNote")}
          </p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 border border-green-200">
            <Lock className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">Secure Checkout</p>
            <p className="text-[11px] text-muted-foreground">SSL encrypted & PCI compliant</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-200">
            <Zap className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">Instant Delivery</p>
            <p className="text-[11px] text-muted-foreground">Keys sent to your email immediately</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">Genuine Keys</p>
            <p className="text-[11px] text-muted-foreground">Same activation as retail software</p>
          </div>
        </div>
      </div>

      {/* Accepted payment methods */}
      <div className="rounded-xl border border-border bg-card px-5 py-3">
        <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Accepted payments</p>
        <div className="flex flex-wrap gap-2">
          {["Visa", "Mastercard", "Amex", "PayPal"].map((method) => (
            <span
              key={method}
              className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted border border-border text-[11px] font-semibold text-muted-foreground"
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
