import { useState, useEffect, useRef } from "react";
import { ShoppingCart, Zap, Heart, GitCompareArrows, Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCurrencyStore } from "@/stores/currency-store";
import { useCartStore } from "@/stores/cart-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { useCompareStore } from "@/stores/compare-store";
import { useToast } from "@/hooks/use-toast";
import { CountdownTimer } from "@/components/flash-sale/countdown-timer";
import { StockUrgencyBadge } from "@/components/social-proof/stock-urgency";
import { PaymentIcons } from "@/components/product-detail/payment-icons";
import type { MockProduct, MockVariant } from "@/lib/mock-data";

interface EnginePrice {
  basePriceUsd: string;
  effectiveUnitPriceUsd: string;
  appliedStack: Array<{ type: string; label: string; savedUsd: string }>;
  isFlashSale: boolean;
  flashSaleId: number | null;
}

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ProductPurchaseCardProps {
  product: MockProduct;
  selectedVariant: MockVariant;
  quantity: number;
  onQuantityChange: (q: number) => void;
}

export function ProductPurchaseCard({ product, selectedVariant, quantity, onQuantityChange }: ProductPurchaseCardProps) {
  const [flashSaleEndsAt, setFlashSaleEndsAt] = useState<string | null>(null);
  const [enginePrice, setEnginePrice] = useState<EnginePrice | null>(null);
  const [added, setAdded] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addToCartRef = useRef<HTMLButtonElement>(null);

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

  // Fetch flash sale countdown
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

  // Sticky bar via IntersectionObserver
  useEffect(() => {
    const btn = addToCartRef.current;
    if (!btn) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(btn);
    return () => observer.disconnect();
  }, []);

  const basePrice = parseFloat(selectedVariant.priceUsd);
  const compareAt = selectedVariant.compareAtPriceUsd ? parseFloat(selectedVariant.compareAtPriceUsd) : null;
  const inStock = selectedVariant.stockCount > 0;
  const canOrder = inStock || !!selectedVariant.backorderAllowed;

  const effectivePrice = enginePrice ? parseFloat(enginePrice.effectiveUnitPriceUsd) : basePrice;
  const engineSavedUsd = enginePrice ? Math.max(0, parseFloat(enginePrice.basePriceUsd) - effectivePrice) : 0;
  const engineDiscount = enginePrice && parseFloat(enginePrice.basePriceUsd) > 0
    ? Math.round((engineSavedUsd / parseFloat(enginePrice.basePriceUsd)) * 100)
    : 0;
  const isFlashSale = enginePrice?.isFlashSale ?? false;
  const hasEngineDiscount = engineDiscount > 0;

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
        priceUsd: enginePrice ? enginePrice.effectiveUnitPriceUsd : selectedVariant.priceUsd,
        platform: selectedVariant.platform,
        regionRestrictions: product.regionRestrictions,
        stockCount: selectedVariant.stockCount,
        backorderAllowed: selectedVariant.backorderAllowed,
        backorderEta: selectedVariant.backorderEta,
      });
    }
    clearTimeout(addedTimer.current);
    setAdded(true);
    addedTimer.current = setTimeout(() => setAdded(false), 3000);
  }

  return (
    <>
      <div className="border rounded-lg p-4 bg-card space-y-4">
        {/* Price display */}
        <div className="flex items-baseline gap-3 flex-wrap">
          {hasEngineDiscount ? (
            <>
              <span className={`text-3xl font-bold ${isFlashSale ? "text-red-600" : "text-orange-600"}`}>
                {formatPrice(effectivePrice)}
              </span>
              <div className="relative group inline-flex items-center gap-1">
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(enginePrice ? parseFloat(enginePrice.basePriceUsd) : basePrice)}
                </span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-gray-800 text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Original price
                </span>
              </div>
              {isFlashSale && (
                <span className="text-xs font-semibold bg-red-600 text-white px-1.5 py-0.5 rounded">
                  FLASH -{engineDiscount}%
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-3xl font-bold text-foreground">{formatPrice(effectivePrice)}</span>
              {compareAt && (
                <div className="relative group inline-flex items-center gap-1">
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(compareAt)}</span>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-gray-800 text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Lowest price in last 30 days
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Flash sale countdown OR active rule label */}
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
              <span className="text-xs text-orange-600 font-semibold">Save {formatPrice(engineSavedUsd)}</span>
            )}
          </div>
        )}

        {/* Stock status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${inStock ? "text-green-600" : canOrder ? "text-amber-600" : "text-red-500"}`}>
            {inStock ? `In Stock (${selectedVariant.stockCount})` : canOrder ? "Available for Pre-order" : "Out of Stock"}
          </span>
          <StockUrgencyBadge stockCount={selectedVariant.stockCount} compact />
        </div>

        {/* Quantity control */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Quantity</label>
          <div className="flex items-center border rounded">
            <button
              className="px-2 py-1.5 hover:bg-muted transition-colors"
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-4 py-1.5 text-sm font-medium min-w-[40px] text-center">{quantity}</span>
            <button
              className="px-2 py-1.5 hover:bg-muted transition-colors"
              onClick={() => {
                const max = selectedVariant.backorderAllowed ? 999 : Math.max(1, selectedVariant.stockCount);
                onQuantityChange(Math.min(max, quantity + 1));
              }}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Add to Cart button */}
        <Button
          ref={addToCartRef}
          size="sm"
          className={`w-full h-9 text-sm transition-colors ${added ? "bg-emerald-500 hover:bg-emerald-500 text-white" : !inStock && canOrder ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
          disabled={!canOrder}
          onClick={handleAddToCart}
        >
          {added ? (
            <><Check className="h-3.5 w-3.5 mr-1.5" /> Added</>
          ) : !inStock && canOrder ? (
            <><ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Pre-order</>
          ) : (
            <><ShoppingCart className="h-3.5 w-3.5 mr-1.5" /> Add to Cart</>
          )}
        </Button>

        {/* Add to Wishlist button */}
        <Button
          size="sm"
          className="w-full h-9 text-sm text-white border-0 ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{ backgroundColor: isWishlisted ? "#ea8a00" : "#f97316" }}
          onClick={() => toggleWishlist(product.id)}
        >
          <Heart className={`h-3.5 w-3.5 mr-1.5 ${isWishlisted ? "fill-white" : ""}`} />
          {isWishlisted ? "In Wishlist" : "Add to Wishlist"}
        </Button>

        {/* Compare + SKU */}
        <div className="flex items-center gap-4 text-sm">
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
          <span className="text-muted-foreground/30">|</span>
          <span className="text-xs text-muted-foreground">SKU: {selectedVariant.sku}</span>
        </div>

        <Separator />

        {/* Payment icons */}
        <PaymentIcons />
      </div>

      {/* Sticky Add to Cart bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border transition-transform duration-300 ease-in-out ${
          showStickyBar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{product.name}</p>
            <p className={`text-lg font-bold ${isFlashSale ? "text-red-600" : hasEngineDiscount ? "text-orange-600" : "text-foreground"}`}>
              {formatPrice(effectivePrice)}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!canOrder}
            onClick={handleAddToCart}
            className={`shrink-0 transition-colors ${added ? "bg-emerald-500 hover:bg-emerald-500 text-white" : !inStock && canOrder ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
          >
            {added ? (
              <><Check className="h-4 w-4 mr-2" /> Added</>
            ) : !inStock && canOrder ? (
              <><ShoppingCart className="h-4 w-4 mr-2" /> Pre-order</>
            ) : (
              <><ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart</>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
