import { useState, useEffect } from "react";
import { ShoppingCart, Zap, Heart, GitCompareArrows, Star, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrencyStore } from "@/stores/currency-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCompareStore } from "@/stores/compare-store";
import { useToast } from "@/hooks/use-toast";
import { CountdownTimer } from "@/components/flash-sale/countdown-timer";
import { ViewerCount } from "@/components/social-proof/viewer-count";
import { SoldBadge } from "@/components/social-proof/sold-badge";
import { StockUrgencyBadge } from "@/components/social-proof/stock-urgency";
import { RegionBadge } from "@/components/product/region-badge";
import { PlatformBadge, ActivationGuideLink } from "@/components/product/platform-badge";
import { VolumePricing } from "@/components/product-detail/volume-pricing";
import type { MockProduct, MockVariant } from "@/lib/mock-data";

interface ProductInfoProps {
  product: MockProduct;
}

interface EnginePrice {
  basePriceUsd: string;
  effectiveUnitPriceUsd: string;
  appliedStack: Array<{ type: string; label: string; savedUsd: string }>;
  isFlashSale: boolean;
  flashSaleId: number | null;
}

const API = import.meta.env.VITE_API_URL ?? "/api";

export function ProductInfo({ product }: ProductInfoProps) {
  const [selectedVariant, setSelectedVariant] = useState<MockVariant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [flashSaleEndsAt, setFlashSaleEndsAt] = useState<string | null>(null);
  const [enginePrice, setEnginePrice] = useState<EnginePrice | null>(null);
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

  // Fetch engine price on variant or quantity change
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/variants/${selectedVariant.id}/price?qty=${quantity}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { price: EnginePrice } | null) => {
        if (!cancelled && d?.price) setEnginePrice(d.price);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedVariant.id, quantity]);

  // Fetch flash sale countdown only (engine handles the price itself)
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/flash-sales/check-variant/${selectedVariant.id}`)
      .then((r) => r.json())
      .then((d: { flashSale: { salePriceUsd: string; endsAt: string } | null }) => {
        if (!cancelled) setFlashSaleEndsAt(d.flashSale?.endsAt ?? null);
      })
      .catch(() => setFlashSaleEndsAt(null));
    return () => { cancelled = true; };
  }, [selectedVariant.id]);

  const basePrice = parseFloat(selectedVariant.priceUsd);
  const compareAt = selectedVariant.compareAtPriceUsd
    ? parseFloat(selectedVariant.compareAtPriceUsd)
    : null;
  const discount = compareAt ? Math.round((1 - basePrice / compareAt) * 100) : 0;
  const inStock = selectedVariant.stockCount > 0;

  // Use engine price when available, fallback to variant base price
  const effectivePrice = enginePrice
    ? parseFloat(enginePrice.effectiveUnitPriceUsd)
    : basePrice;
  const engineSavedUsd = enginePrice
    ? Math.max(0, parseFloat(enginePrice.basePriceUsd) - effectivePrice)
    : 0;
  const engineDiscount = enginePrice && parseFloat(enginePrice.basePriceUsd) > 0
    ? Math.round((engineSavedUsd / parseFloat(enginePrice.basePriceUsd)) * 100)
    : 0;
  const isFlashSale = enginePrice?.isFlashSale ?? false;
  const hasEngineDiscount = engineDiscount > 0;

  // Get the primary rule label from the stack (skip BASE entries)
  const activeRuleLabel = enginePrice?.appliedStack
    .filter((e) => e.type !== "BASE" && parseFloat(e.savedUsd) > 0)
    .map((e) => e.label)[0] ?? null;

  function handleAddToCart() {
    for (let i = 0; i < quantity; i++) {
      addItem({
        variantId: selectedVariant.id,
        productId: product.id,
        productName: product.name,
        variantName: selectedVariant.name,
        imageUrl: product.imageUrl,
        priceUsd: enginePrice
          ? enginePrice.effectiveUnitPriceUsd
          : selectedVariant.priceUsd,
        platform: selectedVariant.platform,
        regionRestrictions: product.regionRestrictions,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {isFlashSale && (
            <Badge className="bg-red-600 text-white flex items-center gap-1">
              <Zap className="h-3 w-3 fill-current" /> FLASH SALE -{engineDiscount}%
            </Badge>
          )}
          {!isFlashSale && hasEngineDiscount && (
            <Badge className="bg-orange-500 text-white flex items-center gap-1">
              -{engineDiscount}% OFF
            </Badge>
          )}
          {product.isNew && !isFlashSale && !hasEngineDiscount && <Badge className="bg-green-500">NEW</Badge>}
          {!isFlashSale && !hasEngineDiscount && discount > 0 && <Badge variant="destructive">-{discount}%</Badge>}
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

      <ViewerCount productId={product.id} />
      <SoldBadge productId={product.id} />

      <div className="flex items-baseline gap-3">
        {hasEngineDiscount ? (
          <>
            <span className={`text-3xl font-bold ${isFlashSale ? "text-red-600" : "text-orange-600"}`}>
              {formatPrice(effectivePrice)}
            </span>
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(enginePrice ? parseFloat(enginePrice.basePriceUsd) : basePrice)}
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold text-foreground">{formatPrice(effectivePrice)}</span>
            {compareAt && (
              <span className="text-lg text-muted-foreground line-through">{formatPrice(compareAt)}</span>
            )}
          </>
        )}
      </div>
      {isFlashSale && flashSaleEndsAt && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <Zap className="h-4 w-4 text-red-600 fill-red-600" />
          <span className="text-sm font-medium text-red-700">Sale ends in</span>
          <CountdownTimer endsAt={flashSaleEndsAt} size="sm" onExpired={() => { setFlashSaleEndsAt(null); setEnginePrice(null); }} />
        </div>
      )}
      {!isFlashSale && activeRuleLabel && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <Zap className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-700">{activeRuleLabel}</span>
          {engineSavedUsd > 0 && (
            <span className="text-xs text-orange-600 font-semibold">
              Save {formatPrice(engineSavedUsd)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <RegionBadge regions={product.regionRestrictions ?? []} />
        <PlatformBadge platformType={product.platformType} />
      </div>
      <ActivationGuideLink platformType={product.platformType} />

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
        <StockUrgencyBadge stockCount={selectedVariant.stockCount} />
      </div>

      <VolumePricing productId={product.id} basePrice={selectedVariant.priceUsd} />

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

