import { useState } from "react";
import { ShoppingCart, Zap, Heart, GitCompareArrows, Star, Eye, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrencyStore } from "@/stores/currency-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCompareStore } from "@/stores/compare-store";
import { useToast } from "@/hooks/use-toast";
import type { MockProduct, MockVariant } from "@/lib/mock-data";

interface ProductInfoProps {
  product: MockProduct;
}

export function ProductInfo({ product }: ProductInfoProps) {
  const [selectedVariant, setSelectedVariant] = useState<MockVariant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const { format: formatPrice } = useCurrencyStore();
  const addItem = useCartStore((s) => s.addItem);
  const wishlistIds = useWishlistStore((s) => s.productIds);
  const toggleWishlist = useWishlistStore((s) => s.toggleProduct);
  const compareIds = useCompareStore((s) => s.productIds);
  const addCompare = useCompareStore((s) => s.addProduct);
  const removeCompare = useCompareStore((s) => s.removeProduct);
  const { toast } = useToast();
  const isWishlisted = wishlistIds.includes(product.id);
  const isComparing = compareIds.includes(product.id);

  const price = parseFloat(selectedVariant.priceUsd);
  const compareAt = selectedVariant.compareAtPriceUsd
    ? parseFloat(selectedVariant.compareAtPriceUsd)
    : null;
  const discount = compareAt ? Math.round((1 - price / compareAt) * 100) : 0;
  const inStock = selectedVariant.stockCount > 0;

  function handleAddToCart() {
    for (let i = 0; i < quantity; i++) {
      addItem({
        variantId: selectedVariant.id,
        productId: product.id,
        productName: product.name,
        variantName: selectedVariant.name,
        imageUrl: product.imageUrl,
        priceUsd: selectedVariant.priceUsd,
        platform: selectedVariant.platform,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {product.isNew && <Badge className="bg-green-500">NEW</Badge>}
          {discount > 0 && <Badge variant="destructive">-{discount}%</Badge>}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${i < Math.round(product.avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {product.avgRating} ({product.reviewCount} reviews)
        </span>
      </div>

      <SocialProofBadge />

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-foreground">
          {formatPrice(price)}
        </span>
        {compareAt && (
          <span className="text-lg text-muted-foreground line-through">
            {formatPrice(compareAt)}
          </span>
        )}
      </div>

      {product.variants.length > 1 && (
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Edition
          </label>
          <div className="flex flex-wrap gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedVariant(v)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  v.id === selectedVariant.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Quantity</label>
        <div className="flex items-center border rounded">
          <button
            className="px-2 py-1.5 hover:bg-muted transition-colors"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-4 py-1.5 text-sm font-medium min-w-[40px] text-center">
            {quantity}
          </span>
          <button
            className="px-2 py-1.5 hover:bg-muted transition-colors"
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <span className={`text-sm ${inStock ? "text-green-600" : "text-red-500"}`}>
          {inStock ? `In Stock (${selectedVariant.stockCount})` : "Out of Stock"}
        </span>
      </div>

      <div className="flex gap-3">
        <Button
          size="lg"
          className="flex-1"
          disabled={!inStock}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Cart
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          disabled={!inStock}
          onClick={handleAddToCart}
        >
          <Zap className="h-4 w-4 mr-2" />
          Buy Now
        </Button>
      </div>

      <div className="flex gap-4 text-sm">
        <button
          onClick={() => toggleWishlist(product.id)}
          className={`flex items-center gap-1.5 transition-colors ${isWishlisted ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${isWishlisted ? "fill-red-500" : ""}`} />
          {isWishlisted ? "In Wishlist" : "Add to Wishlist"}
        </button>
        <button
          onClick={() => {
            if (isComparing) {
              removeCompare(product.id);
            } else if (compareIds.length >= 4) {
              toast({ title: "Compare limit reached", description: "You can compare up to 4 products.", variant: "destructive" });
            } else {
              addCompare(product.id);
            }
          }}
          className={`flex items-center gap-1.5 transition-colors ${isComparing ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <GitCompareArrows className="h-4 w-4" />
          {isComparing ? "Remove from Compare" : "Compare"}
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        SKU: {selectedVariant.sku} | Platform: {selectedVariant.platform}
      </div>
    </div>
  );
}

function SocialProofBadge() {
  const [viewers] = useState(() => Math.floor(Math.random() * 30) + 5);
  return (
    <div className="flex items-center gap-1.5 text-sm text-orange-600">
      <Eye className="h-4 w-4" />
      <span>{viewers} people are viewing this right now</span>
    </div>
  );
}
