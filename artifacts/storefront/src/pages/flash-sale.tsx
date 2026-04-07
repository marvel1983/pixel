import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CountdownTimer } from "@/components/flash-sale/countdown-timer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/hooks/use-toast";
import { Zap, ShoppingCart, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FlashProduct {
  id: number;
  productId: number;
  variantId: number;
  salePriceUsd: string;
  maxQuantity: number;
  soldCount: number;
  productName: string;
  productSlug: string;
  productImage: string | null;
  variantName: string;
  originalPriceUsd: string;
  platform: string | null;
}

interface ActiveSale {
  id: number;
  name: string;
  description: string | null;
  endsAt: string;
  products: FlashProduct[];
}

export default function FlashSalePage() {
  const [sale, setSale] = useState<ActiveSale | null>(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((s) => s.addItem);
  const { toast } = useToast();

  const fetchSale = useCallback(() => {
    fetch(`${API}/flash-sales/active`)
      .then((r) => r.json())
      .then((d) => setSale(d.sale))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSale(); }, [fetchSale]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Breadcrumbs crumbs={[{ label: "Flash Sale" }]} />
        <div className="py-16 text-center">
          <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">No Active Flash Sales</h1>
          <p className="text-muted-foreground mb-6">Check back soon for amazing deals!</p>
          <Link href="/shop"><Button>Browse Shop</Button></Link>
        </div>
      </div>
    );
  }

  function handleAddToCart(p: FlashProduct) {
    const remaining = p.maxQuantity - p.soldCount;
    if (remaining <= 0) { toast({ title: "Sold Out", variant: "destructive" }); return; }
    addItem({
      variantId: p.variantId,
      productId: p.productId,
      productName: p.productName,
      variantName: p.variantName,
      priceUsd: p.salePriceUsd,
      imageUrl: p.productImage || "",
    });
    toast({ title: "Added to cart", description: `${p.productName} at flash sale price!` });
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Flash Sale" }]} />

      <div className="flex flex-col items-center text-center py-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-6 w-6 text-red-500 fill-red-500" />
          <h1 className="text-3xl font-bold">{sale.name}</h1>
          <Zap className="h-6 w-6 text-red-500 fill-red-500" />
        </div>
        {sale.description && <p className="text-muted-foreground mb-4">{sale.description}</p>}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-sm font-medium">Ends in:</span>
          <CountdownTimer endsAt={sale.endsAt} size="lg" onExpired={fetchSale} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
        {sale.products.map((p) => {
          const orig = parseFloat(p.originalPriceUsd);
          const salePrice = parseFloat(p.salePriceUsd);
          const pctOff = orig > 0 ? Math.round(((orig - salePrice) / orig) * 100) : 0;
          const remaining = p.maxQuantity - p.soldCount;
          const soldPct = Math.round((p.soldCount / p.maxQuantity) * 100);
          const soldOut = remaining <= 0;

          return (
            <div key={p.id} className="relative border rounded-lg overflow-hidden bg-white group">
              <Badge className="absolute top-2 left-2 z-10 bg-red-500 text-white text-[10px]">
                -{pctOff}%
              </Badge>
              <Link href={`/product/${p.productSlug}`}>
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-2">
                  {p.productImage ? (
                    <img src={p.productImage} alt={p.productName} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Zap className="h-10 w-10 text-gray-300" />
                  )}
                </div>
              </Link>
              <div className="p-3">
                <Link href={`/product/${p.productSlug}`}>
                  <h3 className="text-xs font-medium line-clamp-2 hover:text-blue-600 mb-1">{p.productName}</h3>
                </Link>
                {p.platform && <span className="text-[10px] text-muted-foreground">{p.platform}</span>}
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-sm font-bold text-red-600">${salePrice.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground line-through">${orig.toFixed(2)}</span>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>{soldOut ? "Sold out" : `${remaining} left`}</span>
                    <span>{soldPct}% sold</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${soldPct}%`, backgroundColor: soldPct > 80 ? "#ef4444" : "#f59e0b" }}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-2 h-7 text-xs"
                  disabled={soldOut}
                  onClick={() => handleAddToCart(p)}
                >
                  <ShoppingCart className="h-3 w-3 mr-1" />
                  {soldOut ? "Sold Out" : "Add to Cart"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
