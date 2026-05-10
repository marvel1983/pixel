import { Link } from "wouter";
import { Sparkles, Package, ShoppingCart, ShieldCheck, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/stores/currency-store";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/hooks/use-toast";
import type { MockProduct, PublicBundle } from "@/lib/mock-data";

interface Props {
  product: MockProduct;
  bundle: PublicBundle;
}

export function BundleHero({ product, bundle }: Props) {
  const format = useCurrencyStore((s) => s.format);
  const addBundleItems = useCartStore((s) => s.addBundleItems);
  const { toast } = useToast();

  const sum = parseFloat(bundle.pricing.sumOriginalUsd);
  const final = parseFloat(bundle.pricing.finalUsd);
  const savings = parseFloat(bundle.pricing.savingsUsd);
  const savingsPct = sum > 0 ? Math.round((savings / sum) * 100) : 0;
  const freeCount = bundle.components.filter((c) => c.isFree).length;

  const ruleBadge = (() => {
    switch (bundle.discountType) {
      case "PERCENTAGE":
        return savingsPct > 0 ? `Save ${savingsPct}%` : null;
      case "FIXED":
        return savings > 0 ? `Save ${format(savings)}` : null;
      case "BUY_X_GET_Y_FREE":
        return freeCount > 0 ? `${freeCount} ${freeCount === 1 ? "item" : "items"} free` : null;
    }
  })();

  function handleAdd() {
    addBundleItems(
      bundle.id,
      product.name,
      bundle.components.map((c) => ({
        variantId: c.variantId,
        productId: c.productId,
        productName: c.name,
        variantName: c.name,
        imageUrl: c.imageUrl,
        priceUsd: c.allocatedPriceUsd,
        platform: c.platform ?? undefined,
        originalPriceUsd: c.unitPriceUsd,
        regionRestrictions: product.regionRestrictions,
        stockCount: 999,
        backorderAllowed: false,
        backorderEta: null,
      })),
    );
    toast({ title: `${product.name} added to cart` });
  }

  return (
    <div className="space-y-4">
      {ruleBadge && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold shadow-sm">
          <Sparkles className="h-3 w-3" />
          {ruleBadge}
        </div>
      )}

      <h1 className="text-2xl font-bold text-foreground leading-tight">{product.name}</h1>
      {product.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          What's in this bundle ({bundle.components.length})
        </div>
        <ul className="space-y-2">
          {bundle.components.map((c) => {
            const price = parseFloat(c.unitPriceUsd);
            return (
              <li key={c.productId}>
                <Link
                  href={`/product/${c.slug}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors -mx-2"
                >
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{c.name}</div>
                  </div>
                  {c.isFree ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground line-through">{format(price)}</span>
                      <span className="text-xs font-bold text-emerald-600">FREE</span>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-foreground shrink-0">{format(price)}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {savings > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sum of items</span>
            <span className="line-through">{format(sum)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-foreground">Bundle price</span>
          <span className="text-3xl font-extrabold text-foreground tabular-nums">{format(final)}</span>
        </div>
        {savings > 0 && (
          <div className="text-right text-sm font-semibold text-emerald-600">You save {format(savings)}</div>
        )}

        <Button
          type="button"
          onClick={handleAdd}
          className="w-full h-11 gap-2 text-sm font-bold"
        >
          <ShoppingCart className="h-4 w-4" />
          Add bundle to cart
        </Button>

        <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border text-[11px] text-muted-foreground">
          <Trust icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Secure" />
          <Trust icon={<Check className="h-3.5 w-3.5" />} label="Genuine keys" />
          <Trust icon={<Zap className="h-3.5 w-3.5" />} label="Instant" />
        </div>
      </div>
    </div>
  );
}

function Trust({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 justify-center">
      <span className="text-muted-foreground/70">{icon}</span>
      <span>{label}</span>
    </div>
  );
}
