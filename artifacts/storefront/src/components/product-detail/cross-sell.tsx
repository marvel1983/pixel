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
    <div className="border rounded-lg p-4 bg-muted/30">
      <h3 className="text-sm font-semibold mb-3">Frequently Bought Together</h3>
      <div className="space-y-2">
        {items.map((product) => {
          const v = product.variants[0];
          return (
            <label
              key={product.id}
              className="flex items-center gap-3 cursor-pointer text-sm"
            >
              <Checkbox
                checked={selected.has(product.id)}
                onCheckedChange={() => toggle(product.id)}
              />
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <span className="flex-1 truncate">{product.name}</span>
              <span className="font-medium">
                {formatPrice(parseFloat(v.priceUsd))}
              </span>
            </label>
          );
        })}
      </div>
      {selected.size > 0 && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <span className="text-sm font-medium">
            Bundle total: {formatPrice(bundleTotal)}
          </span>
          <Button size="sm" onClick={handleAddBundle}>
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Add Bundle
          </Button>
        </div>
      )}
    </div>
  );
}
