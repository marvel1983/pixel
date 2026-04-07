import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Heart, ShoppingCart, Trash2, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";
import type { MockProduct } from "@/lib/mock-data";
import { MOCK_PRODUCTS } from "@/lib/mock-data";

export default function WishlistPage() {
  const { productIds, removeProduct, clearAll } = useWishlistStore();
  const addItem = useCartStore((s) => s.addItem);
  const format = useCurrencyStore((s) => s.format);
  const { toast } = useToast();
  const [products, setProducts] = useState<MockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (productIds.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const idSet = new Set(productIds);
    const found = MOCK_PRODUCTS.filter((p) => idSet.has(p.id));
    setProducts(found);
    setLoading(false);
  }, [productIds]);

  function addAllToCart() {
    let added = 0;
    products.forEach((p) => {
      const v = p.variants[0];
      if (v && v.stockCount > 0) {
        addItem({
          variantId: v.id,
          productId: p.id,
          productName: p.name,
          variantName: v.name,
          imageUrl: p.imageUrl,
          priceUsd: v.priceUsd,
          platform: v.platform,
        });
        added++;
      }
    });
    toast({ title: `${added} item${added !== 1 ? "s" : ""} added to cart` });
  }

  function addOneToCart(p: MockProduct) {
    const v = p.variants[0];
    if (!v) return;
    addItem({
      variantId: v.id,
      productId: p.id,
      productName: p.name,
      variantName: v.name,
      imageUrl: p.imageUrl,
      priceUsd: v.priceUsd,
      platform: v.platform,
    });
    toast({ title: `${p.name} added to cart` });
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Wishlist" }]} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6" /> My Wishlist
          {products.length > 0 && (
            <span className="text-base font-normal text-muted-foreground">
              ({products.length} items)
            </span>
          )}
        </h1>
        {products.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
            <Button size="sm" onClick={addAllToCart}>
              <ShoppingCart className="h-4 w-4 mr-1" /> Add All to Cart
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-2">Your wishlist is empty</p>
          <p className="text-sm mb-4">Save products you love for later.</p>
          <Link href="/shop">
            <Button>Browse Products</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {products.map((p) => {
            const v = p.variants[0];
            if (!v) return null;
            const price = parseFloat(v.priceUsd);
            const comparePrice = v.compareAtPriceUsd ? parseFloat(v.compareAtPriceUsd) : null;
            return (
              <div key={p.id} className="bg-white border rounded-lg overflow-hidden flex flex-col">
                <Link href={`/product/${p.slug}`}>
                  <div className="aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                </Link>
                <div className="p-3 flex flex-col flex-1">
                  <Link href={`/product/${p.slug}`}>
                    <h3 className="text-sm font-medium line-clamp-2 mb-2 hover:text-primary">{p.name}</h3>
                  </Link>
                  <div className="mt-auto space-y-2">
                    <div>
                      <span className="text-base font-bold">{format(price)}</span>
                      {comparePrice && (
                        <span className="text-xs text-muted-foreground line-through ml-1">{format(comparePrice)}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => addOneToCart(p)} disabled={v.stockCount === 0}>
                        <ShoppingCart className="h-3 w-3 mr-1" /> Add
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => removeProduct(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
