import { Link } from "wouter";
import { Star, ShoppingCart, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import type { MockProduct } from "@/lib/mock-data";

interface ProductCardProps {
  product: MockProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const format = useCurrencyStore((s) => s.format);
  const variant = product.variants[0];
  if (!variant) return null;

  const price = parseFloat(variant.priceUsd);
  const comparePrice = variant.compareAtPriceUsd
    ? parseFloat(variant.compareAtPriceUsd)
    : null;
  const discount = comparePrice
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;
  const inStock = variant.stockCount > 0;

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      variantId: variant.id,
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      imageUrl: product.imageUrl,
      priceUsd: variant.priceUsd,
      platform: variant.platform,
    });
  }

  return (
    <Link href={`/product/${product.slug}`}>
      <div className="group bg-white border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <Package className="h-12 w-12 text-muted-foreground/30" />
          )}
          {discount > 0 && (
            <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
              -{discount}%
            </Badge>
          )}
          {product.isNew && (
            <Badge className="absolute top-2 right-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5">
              NEW
            </Badge>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          <div className="flex items-center gap-1 mb-2">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-3 w-3 ${
                    s <= Math.round(product.avgRating)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              ({product.reviewCount})
            </span>
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`text-xs ${inStock ? "text-green-600" : "text-destructive"}`}
            >
              {inStock ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          <div className="mt-auto pt-2 flex items-end justify-between">
            <div>
              <span className="text-base font-bold text-foreground">
                {format(price)}
              </span>
              {comparePrice && (
                <span className="text-xs text-muted-foreground line-through ml-1.5">
                  {format(comparePrice)}
                </span>
              )}
            </div>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleAddToCart}
              disabled={!inStock}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
