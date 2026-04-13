import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
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
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px]">
            {/* Left: items */}
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Your cart is reserved for <strong>24 hours</strong>. Complete your order to secure these prices.</span>
              </div>
              <CartRegionWarning items={items} customerCountry={customerCountry} />
              <CartItemsTable />
            </div>

            {/* Right: one sticky column so summary + trust + payments + upsell scroll together (no overlap) */}
            <div className="min-w-0 space-y-4 rounded-lg bg-background lg:sticky lg:top-24 lg:z-10 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1">
              <CartTotals />
              <ProductUpsell />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
