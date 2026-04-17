import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { X, Star, ShoppingCart, Package, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { useFlashSaleStore } from "@/stores/flash-sale-store";
import { StockUrgencyBadge } from "@/components/social-proof/stock-urgency";
import { RegionBadge } from "@/components/product/region-badge";
import { PlatformBadge } from "@/components/product/platform-badge";
import type { MockProduct } from "@/lib/mock-data";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface QuickViewModalProps {
  product: MockProduct;
  open: boolean;
  onClose: () => void;
}

export function QuickViewModal({ product, open, onClose }: QuickViewModalProps) {
  const { t } = useTranslation();
  const addItem = useCartStore((s) => s.addItem);
  const format = useCurrencyStore((s) => s.format);
  const flashPrices = useFlashSaleStore((s) => s.prices);

  const variant = product.variants?.[0];
  const resolvedFlashPrice = product.variants?.reduce<string | undefined>(
    (found, v) => found ?? flashPrices.get(v.id),
    undefined
  );
  const flashSalePrice = resolvedFlashPrice ?? null;

  const [added, setAdded] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !variant) return null;

  const price = parseFloat(variant.priceUsd);
  const comparePrice = variant.compareAtPriceUsd
    ? parseFloat(variant.compareAtPriceUsd)
    : null;
  const discount = comparePrice
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;
  const inStock = variant.stockCount > 0;
  const displayPrice = flashSalePrice ? parseFloat(flashSalePrice) : price;

  function handleAddToCart() {
    void (async () => {
      let priceUsd = flashSalePrice || variant.priceUsd;
      try {
        const r = await fetch(`${API}/variants/${variant.id}/price?qty=1`);
        if (r.ok) {
          const d = (await r.json()) as { price?: { effectiveUnitPriceUsd?: string } };
          if (d?.price?.effectiveUnitPriceUsd) priceUsd = d.price.effectiveUnitPriceUsd;
        }
      } catch {
        /* keep fallback */
      }
      addItem({
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        variantName: variant.name,
        imageUrl: product.imageUrl,
        priceUsd,
        platform: variant.platform,
        regionRestrictions: product.regionRestrictions,
      });
      clearTimeout(addedTimer.current);
      setAdded(true);
      addedTimer.current = setTimeout(() => setAdded(false), 3000);
    })();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={`Quick view: ${product.name}`}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col sm:flex-row animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Product Image */}
        <div className="relative w-full sm:w-1/2 aspect-square bg-gradient-to-br from-muted to-muted/50 shrink-0">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          {discount > 0 && (
            <Badge
              variant="destructive"
              className="absolute left-3 top-3 text-xs px-2 py-0.5 pointer-events-none"
            >
              -{discount}%
            </Badge>
          )}
          {product.isNew && (
            <Badge className="absolute right-3 top-3 bg-green-600 text-white text-xs px-2 py-0.5 pointer-events-none">
              NEW
            </Badge>
          )}
        </div>

        {/* Right: Product Info */}
        <div className="relative flex flex-col gap-3 p-5 w-full sm:w-1/2 overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            aria-label="Close quick view"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Name */}
          <h2 className="text-base font-semibold text-foreground leading-snug pr-8">
            {product.name}
          </h2>

          {/* Stars */}
          <div className="flex items-center gap-1.5">
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-3.5 w-3.5 ${
                    s <= Math.round(product.avgRating)
                      ? "text-yellow-400 fill-yellow-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              ({product.reviewCount} reviews)
            </span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold leading-tight ${
                flashSalePrice ? "text-red-600" : "text-foreground"
              }`}
            >
              {format(displayPrice)}
            </span>
            {flashSalePrice && (
              <span className="text-sm text-muted-foreground line-through">
                {format(price)}
              </span>
            )}
            {!flashSalePrice && comparePrice != null && (
              <span className="text-sm text-muted-foreground line-through">
                {format(comparePrice)}
              </span>
            )}
          </div>

          {/* Stock + Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`text-xs font-medium ${
                inStock ? "text-green-600" : "text-destructive"
              }`}
            >
              {inStock ? t("product.inStock") : t("product.outOfStock")}
            </span>
            <RegionBadge regions={product.regionRestrictions ?? []} compact />
            <StockUrgencyBadge stockCount={variant.stockCount} compact />
          </div>

          {/* Platform badge */}
          {product.platformType && (
            <div className="flex flex-wrap gap-1">
              <PlatformBadge platformType={product.platformType} compact />
            </div>
          )}

          {/* Description excerpt */}
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              className={`h-9 w-full gap-2 text-xs font-semibold text-white transition-colors ${
                added
                  ? "bg-emerald-500 hover:bg-emerald-500"
                  : "bg-primary hover:bg-primary/90"
              }`}
              onClick={handleAddToCart}
              disabled={!inStock}
            >
              {added ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Added to Cart
                </>
              ) : (
                <>
                  <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
                  {t("product.addToCart")}
                </>
              )}
            </Button>

            <Link
              href={`/product/${product.slug}`}
              onClick={onClose}
              className="flex items-center justify-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              View Full Details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
