import { Package, Minus, Plus, Trash2, ChevronDown, ChevronUp, Tag, Clock } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore, type CartItem } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

export function CartItemsTable() {
  const { t } = useTranslation();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const updateItemPrice = useCartStore((s) => s.updateItemPrice);
  const updateItemStock = useCartStore((s) => s.updateItemStock);
  const removeItem = useCartStore((s) => s.removeItem);
  const removeBundleItems = useCartStore((s) => s.removeBundleItems);
  const clearCart = useCartStore((s) => s.clearCart);
  const { format } = useCurrencyStore();

  const cartPriceSyncKey = useMemo(
    () =>
      items
        .filter((i) => !i.bundleId && i.variantId > 0)
        .map((i) => `${i.variantId}:${i.quantity}`)
        .sort()
        .join("|"),
    [items],
  );

  useEffect(() => {
    if (!cartPriceSyncKey) return;
    let cancelled = false;
    const lines = useCartStore.getState().items.filter((i) => !i.bundleId && i.variantId > 0);
    (async () => {
      // Sync prices
      for (const item of lines) {
        try {
          const r = await fetch(`${API}/variants/${item.variantId}/price?qty=${item.quantity}`);
          if (!r.ok || cancelled) continue;
          const d = (await r.json()) as { price?: { effectiveUnitPriceUsd?: string } };
          const next = d?.price?.effectiveUnitPriceUsd;
          if (next) updateItemPrice(item.variantId, next);
        } catch { /* ignore */ }
      }
      // Sync stock / backorder info in one batch call
      if (!cancelled && lines.length > 0) {
        try {
          const r = await fetch(`${API}/variants/stock-batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variantIds: lines.map((i) => i.variantId) }),
          });
          if (r.ok && !cancelled) {
            const d = (await r.json()) as { stock?: Record<string, { stockCount: number; backorderAllowed: boolean; backorderEta: string | null }> };
            if (d.stock) {
              for (const [idStr, info] of Object.entries(d.stock)) {
                updateItemStock(Number(idStr), info);
              }
            }
          }
        } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [cartPriceSyncKey, updateItemPrice, updateItemStock]);

  function handleUpdateQuantity(variantId: number, qty: number, bundleId?: number) {
    updateQuantity(variantId, qty, bundleId);
    if (!bundleId && qty > 0) {
      fetch(`${API}/variants/${variantId}/price?qty=${qty}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { price: { effectiveUnitPriceUsd: string } } | null) => {
          if (d?.price) updateItemPrice(variantId, d.price.effectiveUnitPriceUsd);
        })
        .catch(() => {});
    }
  }

  const bundleGroups = new Map<number, CartItem[]>();
  const standaloneItems: CartItem[] = [];
  for (const item of items) {
    if (item.bundleId) {
      const group = bundleGroups.get(item.bundleId) || [];
      group.push(item);
      bundleGroups.set(item.bundleId, group);
    } else {
      standaloneItems.push(item);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[1fr_100px_140px_100px_44px] gap-4 px-5 py-2.5 bg-muted/40 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("cart.product")}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">{t("cart.price")}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">{t("cart.quantity")}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">{t("cart.subtotal")}</span>
        <span />
      </div>

      {/* Bundle groups */}
      {Array.from(bundleGroups.entries()).map(([bundleId, bundleItems]) => (
        <BundleGroup
          key={`bundle-${bundleId}`}
          bundleId={bundleId}
          items={bundleItems}
          format={format}
          onRemoveBundle={removeBundleItems}
          onRemoveItem={removeItem}
        />
      ))}

      {/* Standalone items */}
      {standaloneItems.map((item, idx) => (
        <CartRow
          key={`standalone-${item.variantId}`}
          item={item}
          format={format}
          onUpdateQuantity={handleUpdateQuantity}
          onRemove={removeItem}
          isLast={idx === standaloneItems.length - 1 && bundleGroups.size === 0}
        />
      ))}

      {/* Footer actions */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-border bg-muted/20">
        <Link href="/shop">
          <button className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            ← {t("cart.returnToShop")}
          </button>
        </Link>
        <button
          onClick={clearCart}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("cart.clearCart")}
        </button>
      </div>
    </div>
  );
}

function BundleGroup({ bundleId, items, format, onRemoveBundle, onRemoveItem }: {
  bundleId: number;
  items: CartItem[];
  format: (usd: number) => string;
  onRemoveBundle: (id: number) => void;
  onRemoveItem: (id: number, bundleId?: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const bundleName = items[0]?.bundleName || "Bundle";
  const bundleTotal = items.reduce((s, i) => s + parseFloat(i.priceUsd) * i.quantity, 0);
  const originalTotal = items.reduce((s, i) => s + parseFloat(i.originalPriceUsd || i.priceUsd) * i.quantity, 0);
  const savings = originalTotal - bundleTotal;

  return (
    <div className="border-t border-border">
      <div
        className="flex items-center gap-3 px-6 py-3 bg-blue-50/60 dark:bg-blue-950/20 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Package className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">{bundleName}</span>
        {savings > 0 && (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] gap-1">
            <Tag className="h-2.5 w-2.5" /> Saves {format(savings)}
          </Badge>
        )}
        <span className="font-bold text-sm">{format(bundleTotal)}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemoveBundle(bundleId); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
      {expanded && items.map((item) => (
        <div
          key={`${bundleId}-${item.variantId}`}
          className="grid grid-cols-1 sm:grid-cols-[1fr_100px_140px_100px_44px] gap-3 sm:gap-4 px-6 pl-14 py-3 items-center border-t border-border/50 bg-blue-50/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain" />
                : <Package className="h-4 w-4 text-muted-foreground/40" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.productName}</p>
              <p className="text-xs text-muted-foreground">{item.variantName}</p>
            </div>
          </div>
          <div className="text-sm text-center">
            {item.originalPriceUsd && parseFloat(item.originalPriceUsd) > parseFloat(item.priceUsd) && (
              <span className="text-xs text-muted-foreground line-through block">{format(parseFloat(item.originalPriceUsd))}</span>
            )}
            <span className="font-medium">{format(parseFloat(item.priceUsd))}</span>
          </div>
          <div className="text-sm text-center text-muted-foreground">×{item.quantity}</div>
          <div className="text-sm text-right font-semibold">{format(parseFloat(item.priceUsd) * item.quantity)}</div>
          <div className="flex justify-end">
            <button
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={() => onRemoveItem(item.variantId, item.bundleId)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface CartRowProps {
  item: CartItem;
  format: (usd: number) => string;
  onUpdateQuantity: (variantId: number, qty: number, bundleId?: number) => void;
  onRemove: (variantId: number, bundleId?: number) => void;
  isLast?: boolean;
}

function BackorderNotice({ item }: { item: CartItem }) {
  const stock = item.stockCount ?? 0;
  const backorderQty = item.backorderAllowed ? Math.max(0, item.quantity - stock) : 0;
  const inStockQty = Math.min(item.quantity, stock);
  if (!item.backorderAllowed || backorderQty === 0) return null;

  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
      <Clock className="h-3 w-3 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
      <span>
        {inStockQty > 0
          ? <><strong>{inStockQty}</strong> available now · <strong>{backorderQty}</strong> on backorder</>
          : <><strong>{backorderQty}</strong> on backorder</>
        }
        {item.backorderEta && <> · Est. delivery: <strong>{item.backorderEta}</strong></>}
      </span>
    </div>
  );
}

function CartRow({ item, format, onUpdateQuantity, onRemove }: CartRowProps) {
  const price = parseFloat(item.priceUsd);
  const subtotal = price * item.quantity;

  return (
    <div
      className="grid gap-x-3 gap-y-3 px-4 py-4 border-t border-border items-center grid-cols-[auto_1fr_auto] [grid-template-areas:'product_product_remove'_'qty_._total'] sm:grid-cols-[1fr_100px_140px_100px_44px] sm:gap-4 sm:px-5 sm:py-3 sm:[grid-template-areas:'product_price_qty_total_remove']"
    >
      <div className="[grid-area:product] flex items-center gap-3 min-w-0">
        <div className="w-14 h-14 sm:w-12 sm:h-12 rounded-xl border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain" />
            : <Package className="h-6 w-6 sm:h-5 sm:w-5 text-muted-foreground/30" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug mb-0.5">{item.productName}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs text-muted-foreground">{item.variantName}</p>
            {item.platform && (
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                {item.platform}
              </span>
            )}
            {item.regionRestrictions && item.regionRestrictions.length > 0 && (
              <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                {item.regionRestrictions.join(", ")}
              </span>
            )}
          </div>
          <BackorderNotice item={item} />
        </div>
      </div>

      <div className="[grid-area:price] hidden sm:block text-sm text-center font-medium text-foreground">{format(price)}</div>

      <div className="[grid-area:qty] flex items-center sm:justify-center">
        <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
          <button
            className="px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40"
            onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1, item.bundleId)}
            disabled={item.quantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="w-10 text-center text-sm font-semibold select-none">{item.quantity}</span>
          <button
            className="px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1, item.bundleId)}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="[grid-area:total] text-right">
        <span className="sm:hidden block text-[11px] text-muted-foreground">{format(price)} each</span>
        <span className="text-base sm:text-sm font-bold text-foreground">{format(subtotal)}</span>
      </div>

      <div className="[grid-area:remove] flex justify-end">
        <button
          type="button"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          onClick={() => onRemove(item.variantId, item.bundleId)}
          title="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
