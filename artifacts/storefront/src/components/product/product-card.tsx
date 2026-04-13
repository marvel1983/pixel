import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Star, ShoppingCart, Package, Heart, GitCompareArrows, Zap, Check, Eye } from "lucide-react";
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
import { RegionBadge } from "@/components/product/region-badge";
import { PlatformBadge } from "@/components/product/platform-badge";
import { QuickViewModal } from "@/components/product/quick-view-modal";
import { CountdownTimer } from "@/components/flash-sale/countdown-timer";
import type { MockProduct } from "@/lib/mock-data";

interface ProductCardProps {
  product: MockProduct;
  flashSalePrice?: string | null;
}

export function ProductCard({ product, flashSalePrice: flashSalePriceProp }: ProductCardProps) {
  const flashPrices = useFlashSaleStore((s) => s.prices);
  const saleEndsAt = useFlashSaleStore((s) => s.endsAt);
  const { t } = useTranslation();
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

  const isNewRecently = product.isNew && product.createdAt
    ? (Date.now() - new Date(product.createdAt).getTime()) < 14 * 24 * 60 * 60 * 1000
    : product.isNew;

  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>();
  const [heartPulse, setHeartPulse] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
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
      regionRestrictions: product.regionRestrictions,
    });
    clearTimeout(addedTimer.current);
    setAdded(true);
    addedTimer.current = setTimeout(() => setAdded(false), 3000);
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product.id);
    setHeartPulse(true);
  }

  useEffect(() => {
    if (!heartPulse) return;
    const timer = setTimeout(() => setHeartPulse(false), 300);
    return () => clearTimeout(timer);
  }, [heartPulse]);

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
    <>
    <Link href={`/product/${product.slug}`} onClick={() => addToRecentlyViewed(product.id)}>
      <div className="group bg-card border border-border rounded-lg hover:shadow-md transition-shadow h-full flex flex-col">
        <div className="relative aspect-[4/3] shrink-0 rounded-t-lg">
          {/* Clip only the image so discount / NEW badges are not cut off by overflow-hidden */}
          <div className="absolute inset-0 overflow-hidden rounded-t-lg bg-gradient-to-br from-muted to-muted/50">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
          </div>
          {discount > 0 && (
            <Badge
              variant="destructive"
              className="no-default-hover-elevate pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate text-[10px] px-1.5 py-0.5 shadow-sm"
            >
              -{discount}%
            </Badge>
          )}
          {flashSalePrice && (
            <div className="absolute bottom-2 left-2 z-10 flex flex-col items-start gap-0.5">
              <Badge className="no-default-hover-elevate pointer-events-none bg-red-600 text-white text-[10px] px-1.5 py-0.5 flex items-center gap-0.5 shadow-sm">
                <Zap className="h-2.5 w-2.5 fill-current" /> FLASH SALE
              </Badge>
              {saleEndsAt && (
                <div className="flex items-center gap-1 bg-red-700/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm pointer-events-none">
                  <Zap className="h-2.5 w-2.5 fill-current shrink-0" />
                  <CountdownTimer endsAt={saleEndsAt} size="xs" className="text-[9px]" />
                </div>
              )}
            </div>
          )}
          {isNewRecently && !flashSalePrice && (
            <Badge className="no-default-hover-elevate pointer-events-none absolute right-2 top-2 z-10 bg-green-600 text-white text-[10px] px-1.5 py-0.5 shadow-sm">
              NEW
            </Badge>
          )}
          <div className="absolute right-2 top-2 z-20 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isNewRecently && <span />}
            <button
              onClick={handleWishlist}
              className={`w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors ${isWishlisted ? "text-red-500" : "text-muted-foreground"} ${heartPulse ? "animate-heart-pulse" : ""}`}
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
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuickViewOpen(true); }}
            className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs py-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 z-20"
          >
            <Eye className="h-3 w-3" /> Quick View
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center p-3 text-center">
          <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          <div className="flex items-center justify-center gap-1 mb-2">
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

          <div className="flex items-center justify-center gap-1.5 mb-1 flex-wrap">
            <span className={`text-xs ${inStock ? "text-green-600" : "text-destructive"}`}>
              {inStock ? t("product.inStock") : t("product.outOfStock")}
            </span>
            <RegionBadge regions={product.regionRestrictions ?? []} compact />
            <StockUrgencyBadge stockCount={variant.stockCount} compact />
            <SoldBadge productId={product.id} compact />
          </div>
          <div className="flex items-center justify-center gap-1 mb-1 flex-wrap">
            <PlatformBadge platformType={product.platformType} compact />
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-3 w-full">
            <div className="flex items-baseline justify-center gap-2">
              {flashSalePrice ? (
                <>
                  <span className="text-lg font-bold leading-tight text-red-600">
                    {format(parseFloat(flashSalePrice))}
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground line-through">
                    {format(price)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg font-bold leading-tight text-foreground">{format(price)}</span>
                  {comparePrice != null && (
                    <span className="text-xs leading-tight text-muted-foreground line-through">
                      {format(comparePrice)}
                    </span>
                  )}
                </>
              )}
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              className={`no-default-hover-elevate no-default-active-elevate h-9 min-h-9 w-full gap-2 rounded-lg border-0 px-3 text-xs font-semibold text-white shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 ${added ? "bg-emerald-500 hover:bg-emerald-500" : "bg-primary hover:bg-primary/90 active:bg-primary/85"}`}
              onClick={handleAddToCart}
              disabled={!inStock}
            >
              {added ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Added
                </>
              ) : (
                <>
                  <ShoppingCart className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("product.addToCart")}
                </>
              )}
            </Button>
            {loyaltyConfig && (
              <p
                className="text-center text-xs font-medium leading-snug tracking-tight text-emerald-700 dark:text-emerald-400"
                title={t("product.loyaltyEarnHint")}
              >
                <span className="tabular-nums">
                  {t("product.loyaltyEarnApprox", {
                    points: Math.floor(price * loyaltyConfig.pointsPerDollar),
                  })}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
    <QuickViewModal product={product} open={quickViewOpen} onClose={() => setQuickViewOpen(false)} />
    </>
  );
}
