import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Lock, Zap, ShieldCheck } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { CartProgress } from "@/components/cart/cart-progress";
import { CartItemsTable } from "@/components/cart/cart-items-table";
import { CartTotals } from "@/components/cart/cart-totals";
import { ProductUpsell } from "@/components/checkout/product-upsell";
import { EmptyCart } from "@/components/cart/empty-cart";
import { CartRegionWarning, detectCountryFromLocale } from "@/components/cart/region-warning";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

export default function CartPage() {
  const { t } = useTranslation();
  const items = useCartStore((s) => s.items);
  const backorderItems = useMemo(() =>
    items.filter((i) => i.backorderAllowed && i.quantity > (i.stockCount ?? 0)),
    [items],
  );
  const isEmpty = items.length === 0;
  const customerCountry = useMemo(() => detectCountryFromLocale(), []);

  useEffect(() => {
    setSeoMeta({ title: t("seo.cartTitle"), description: t("seo.cartDescription") });
    return () => { clearSeoMeta(); };
  }, [t]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t("cart.title")}</h1>
          {!isEmpty && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {items.reduce((s, i) => s + i.quantity, 0)} item{items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""} in your cart
            </p>
          )}
        </div>

        {/* Step progress */}
        <CartProgress step={1} />

        {isEmpty ? (
          <EmptyCart />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_380px]">
              {/* Left: items + upsell */}
              <div className="space-y-4 min-w-0">
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Your cart is reserved for <strong>24 hours</strong>. Complete your order to secure these prices.</span>
                </div>
                <CartRegionWarning items={items} customerCountry={customerCountry} />
                {backorderItems.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-semibold mb-0.5">Some items are on backorder</p>
                      <p>
                        {backorderItems.map((i) => {
                          const stock = i.stockCount ?? 0;
                          const boQty = i.quantity - Math.min(i.quantity, stock);
                          return `${i.productName} (${boQty} on backorder${i.backorderEta ? `, est. ${i.backorderEta}` : ""})`;
                        }).join(" · ")}
                      </p>
                      <p className="mt-1 text-amber-700 dark:text-amber-400">Your order will be placed now. Backordered keys are delivered automatically once our supplier ships them.</p>
                    </div>
                  </div>
                )}
                <CartItemsTable />
                <ProductUpsell />
              </div>

              {/* Right: sticky order summary only */}
              <div className="min-w-0 lg:sticky lg:top-24 lg:z-10 lg:self-start">
                <CartTotals />
              </div>
            </div>

            {/* Full-width trust + payments strip */}
            <div className="mt-8 rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-900">
                    <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Secure Checkout</p>
                    <p className="text-xs text-muted-foreground">SSL encrypted & PCI compliant</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/40 dark:border-blue-900">
                    <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Instant Delivery</p>
                    <p className="text-xs text-muted-foreground">Keys sent to your email immediately</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">Genuine Keys</p>
                    <p className="text-xs text-muted-foreground">Same activation as retail software</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-4 flex-wrap bg-muted/20">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Accepted payments</p>
                <div className="flex flex-wrap gap-2">
                  {["Visa", "Mastercard", "Amex", "PayPal"].map((method) => (
                    <span
                      key={method}
                      className="inline-flex items-center px-2.5 py-1 rounded-md bg-background border border-border text-[11px] font-semibold text-muted-foreground"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
