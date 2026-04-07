import { Link } from "wouter";
import { Star, ShoppingCart, Package, Heart, GitCompareArrows, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCompareStore } from "@/stores/compare-store";
import { useFlashSaleStore } from "@/stores/flash-sale-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { addToRecentlyViewed } from "@/components/home/recently-viewed";
import { useToast } from "@/hooks/use-toast";
import { StockUrgencyBadge } from "@/components/social-proof/stock-urgency";
import { SoldBadge } from "@/components/social-proof/sold-badge";
import type { MockProduct } from "@/lib/mock-data";

interface ProductCardProps {
  product: MockProduct;
  flashSalePrice?: string | null;
}

export function ProductCard({ product, flashSalePrice: flashSalePriceProp }: ProductCardProps) {
  const flashPrices = useFlashSaleStore((s) => s.prices);
  const variant = product.variants?.[0];
  const resolvedFlashPrice = product.variants?.reduce<string | undefined>((found, v) => found ?? flashPrices.get(v.id), undefined);
  const flashSalePrice = flashSalePriceProp ?? resolvedFlashPrice ?? null;
  const addItem = useCartStore((s) => s.addItem);
  const format = useCurrencyStore((s) => s.format);
  const { toast } = useToast();
  const wishlistIds = useWishlistStore((s) => s.productIds);
  const toggleWishlist = useWishlistStore((s) => s.toggleProduct);
  const compareIds = useCompareStore((s) => s.productIds);
  const addCompare = useCompareStore((s) => s.addProduct);
  const removeCompare = useCompareStore((s) => s.removeProduct);

  const loyaltyConfig = useLoyaltyStore((s) => s.config);
  const isWishlisted = wishlistIds.includes(product.id);
  const isComparing = compareIds.includes(product.id);
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
      priceUsd: flashSalePrice || variant.priceUsd,
      platform: variant.platform,
    });
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
  }

  function handleCompare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isComparing) {
      removeCompare(product.id);
    } else if (compareIds.length >= 4) {
      toast({ title: "Compare limit reached", description: "You can compare up to 4 products at a time.", variant: "destructive" });
    } else {
      addCompare(product.id);
    }
  }

  return (
    <Link href={`/product/${product.slug}`} onClick={() => addToRecentlyViewed(product.id)}>
      <div className="group bg-white border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="h-12 w-12 text-muted-foreground/30" />
          )}
          {discount > 0 && (
            <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
              -{discount}%
            </Badge>
          )}
          {flashSalePrice && (
            <Badge className="absolute bottom-2 left-2 bg-red-600 text-white text-[10px] px-1.5 py-0.5 flex items-center gap-0.5">
              <Zap className="h-2.5 w-2.5 fill-current" /> FLASH SALE
            </Badge>
          )}
          {product.isNew && !flashSalePrice && (
            <Badge className="absolute top-2 right-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5">
              NEW
            </Badge>
          )}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!product.isNew && <span />}
            <button
              onClick={handleWishlist}
              className={`w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors ${isWishlisted ? "text-red-500" : "text-muted-foreground"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${isWishlisted ? "fill-red-500" : ""}`} />
            </button>
            <button
              onClick={handleCompare}
              className={`w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors ${isComparing ? "text-primary" : "text-muted-foreground"}`}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </button>
          </div>
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
                  className={`h-3 w-3 ${s <= Math.round(product.avgRating) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
          </div>

          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`text-xs ${inStock ? "text-green-600" : "text-destructive"}`}>
              {inStock ? "In Stock" : "Out of Stock"}
            </span>
            <StockUrgencyBadge stockCount={variant.stockCount} compact />
            <SoldBadge productId={product.id} compact />
          </div>

          <div className="mt-auto pt-2 flex items-end justify-between">
            <div>
              {flashSalePrice ? (
                <>
                  <span className="text-base font-bold text-red-600">{format(parseFloat(flashSalePrice))}</span>
                  <span className="text-xs text-muted-foreground line-through ml-1.5">{format(price)}</span>
                </>
              ) : (
                <>
                  <span className="text-base font-bold text-foreground">{format(price)}</span>
                  {comparePrice && (
                    <span className="text-xs text-muted-foreground line-through ml-1.5">{format(comparePrice)}</span>
                  )}
                </>
              )}
            </div>
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAddToCart} disabled={!inStock}>
              <ShoppingCart className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
          {loyaltyConfig && (
            <p className="text-[10px] text-yellow-600 mt-0.5">
              Earn ~{Math.floor(price * loyaltyConfig.pointsPerDollar)} pts
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
