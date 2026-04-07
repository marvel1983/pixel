import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

export function ProductUpsell() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const { format } = useCurrencyStore();
  const { toast } = useToast();

  const cartProductIds = new Set(items.map((i) => i.productId));
  const suggestions = MOCK_PRODUCTS.filter(
    (p) => p.isFeatured && !cartProductIds.has(p.id),
  ).slice(0, 2);

  if (suggestions.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 bg-blue-50/50 border-blue-200">
      <h3 className="text-sm font-semibold mb-3">Complete Your Order</h3>
      <div className="space-y-2">
        {suggestions.map((p) => {
          const v = p.variants[0];
          const price = parseFloat(v.priceUsd);
          return (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-white border flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{format(price)}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  addItem({
                    variantId: v.id,
                    productId: p.id,
                    productName: p.name,
                    variantName: v.name,
                    imageUrl: p.imageUrl,
                    priceUsd: v.priceUsd,
                    platform: v.platform,
                  });
                  toast({ title: `${p.name} added to order` });
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
