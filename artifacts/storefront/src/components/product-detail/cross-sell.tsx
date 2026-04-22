import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency-store";
import { useCartStore } from "@/stores/cart-store";
import type { MockProduct } from "@/lib/mock-data";

interface CrossSellProps {
  currentProduct: MockProduct;
  relatedProducts: MockProduct[];
}

export function CrossSell({ currentProduct, relatedProducts }: CrossSellProps) {
  const items = relatedProducts.slice(0, 3);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { format: formatPrice } = useCurrencyStore();
  const addItem = useCartStore((s) => s.addItem);

  if (items.length === 0) return null;

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const currentPrice = parseFloat(currentProduct.variants[0].priceUsd);
  const bundleTotal =
    currentPrice +
    items
      .filter((p) => selected.has(p.id))
      .reduce((sum, p) => sum + parseFloat(p.variants[0].priceUsd), 0);

  function handleAddBundle() {
    const toAdd = [currentProduct, ...items.filter((p) => selected.has(p.id))];
    toAdd.forEach((p) => {
      const v = p.variants[0];
      addItem({
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        variantName: v.name,
        imageUrl: p.imageUrl,
        priceUsd: v.priceUsd,
        platform: v.platform,
      });
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-muted/30">
        <h3 className="text-sm font-bold text-foreground tracking-wide">
          Frequently Bought Together
        </h3>
      </div>

      {/* Items */}
      <div className="divide-y divide-border">
        {items.map((product) => {
          const v = product.variants[0];
          const isChecked = selected.has(product.id);
          return (
            <label
              key={product.id}
              className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${
                isChecked ? "bg-primary/3" : "hover:bg-muted/30"
              }`}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggle(product.id)}
                className="shrink-0"
              />
              <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Package className="h-5 w-5 text-muted-foreground/40" />
                )}
              </div>
              <span className="flex-1 text-sm font-medium truncate text-foreground">
                {product.name}
              </span>
              <span className="text-sm font-bold text-foreground shrink-0">
                {formatPrice(parseFloat(v.priceUsd))}
              </span>
            </label>
          );
        })}
      </div>

      {/* Footer — always visible, button activates when items selected */}
      <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {selected.size > 0 ? (
            <span>
              Bundle total:{" "}
              <span className="font-bold text-foreground">{formatPrice(bundleTotal)}</span>
            </span>
          ) : (
            <span>Select items to bundle</span>
          )}
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0}
          onClick={handleAddBundle}
          className="shrink-0"
        >
          <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
          Add to Cart
        </Button>
      </div>
    </div>
  );
}
