import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

interface Offer {
  id: number;
  name: string;
  imageUrl: string | null;
  variantId: number;
  variantName: string;
  priceUsd: string;
  platform: string | null;
}

export function ProductUpsell() {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const { format } = useCurrencyStore();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);

  const cartProductIds = new Set(items.map((i) => i.productId));

  useEffect(() => {
    const excludeIds = items.map((i) => i.productId).join(",");
    const baseUrl = import.meta.env.VITE_API_URL ?? "/api";

    fetch(`${baseUrl}/checkout/offers?exclude=${excludeIds}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.offers?.length > 0) {
          setOffers(data.offers);
        } else {
          const fallback = MOCK_PRODUCTS.filter(
            (p) => p.isFeatured && !cartProductIds.has(p.id),
          )
            .slice(0, 2)
            .map((p) => ({
              id: p.id,
              name: p.name,
              imageUrl: p.imageUrl,
              variantId: p.variants[0].id,
              variantName: p.variants[0].name,
              priceUsd: p.variants[0].priceUsd,
              platform: p.variants[0].platform,
            }));
          setOffers(fallback);
        }
      })
      .catch(() => {
        const fallback = MOCK_PRODUCTS.filter(
          (p) => p.isFeatured && !cartProductIds.has(p.id),
        )
          .slice(0, 2)
          .map((p) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            variantId: p.variants[0].id,
            variantName: p.variants[0].name,
            priceUsd: p.variants[0].priceUsd,
            platform: p.variants[0].platform,
          }));
        setOffers(fallback);
      });
  }, [items.length]);

  if (offers.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 bg-blue-50/50 border-blue-200">
      <h3 className="text-sm font-semibold mb-3">Complete Your Order</h3>
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.variantId} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-card border flex items-center justify-center shrink-0">
              {o.imageUrl ? (
                <img src={o.imageUrl} alt="" className="w-full h-full object-contain rounded" />
              ) : (
                <Package className="h-4 w-4 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{o.name}</p>
              <p className="text-xs text-muted-foreground">{format(parseFloat(o.priceUsd))}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                addItem({
                  variantId: o.variantId,
                  productId: o.id,
                  productName: o.name,
                  variantName: o.variantName,
                  imageUrl: o.imageUrl,
                  priceUsd: o.priceUsd,
                  platform: o.platform ?? undefined,
                });
                toast({ title: `${o.name} added to order` });
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
