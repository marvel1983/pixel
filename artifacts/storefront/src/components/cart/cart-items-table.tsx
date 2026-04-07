import { Package, Minus, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore, type CartItem } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";

export function CartItemsTable() {
  const { t } = useTranslation();
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const removeBundleItems = useCartStore((s) => s.removeBundleItems);
  const { format } = useCurrencyStore();

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
    <div className="border rounded-lg overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1fr_120px_140px_100px_40px] gap-4 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
        <span>{t("cart.product")}</span>
        <span className="text-center">{t("cart.price")}</span>
        <span className="text-center">{t("cart.quantity")}</span>
        <span className="text-right">{t("cart.subtotal")}</span>
        <span />
      </div>

      {Array.from(bundleGroups.entries()).map(([bundleId, bundleItems]) => (
        <BundleGroup key={`bundle-${bundleId}`} bundleId={bundleId} items={bundleItems}
          format={format} onRemoveBundle={removeBundleItems} onRemoveItem={removeItem} />
      ))}

      {standaloneItems.map((item) => (
        <CartRow key={`standalone-${item.variantId}`} item={item} format={format}
          onUpdateQuantity={updateQuantity} onRemove={removeItem} />
      ))}
    </div>
  );
}

function BundleGroup({ bundleId, items, format, onRemoveBundle, onRemoveItem }: {
  bundleId: number; items: CartItem[]; format: (usd: number) => string;
  onRemoveBundle: (id: number) => void; onRemoveItem: (id: number, bundleId?: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const bundleName = items[0]?.bundleName || "Bundle";
  const bundleTotal = items.reduce((s, i) => s + parseFloat(i.priceUsd) * i.quantity, 0);
  const originalTotal = items.reduce((s, i) => s + parseFloat(i.originalPriceUsd || i.priceUsd) * i.quantity, 0);
  const savings = originalTotal - bundleTotal;

  return (
    <div className="border-t">
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <button className="p-0.5">{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
        <Package className="h-5 w-5 text-blue-600" />
        <span className="font-medium flex-1">{bundleName}</span>
        {savings > 0 && <Badge className="bg-green-100 text-green-800 text-xs">Bundle saves {format(savings)}</Badge>}
        <span className="font-semibold">{format(bundleTotal)}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemoveBundle(bundleId); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expanded && items.map((item) => (
        <div key={`${bundleId}-${item.variantId}`} className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_100px_40px] gap-3 sm:gap-4 px-4 pl-12 py-2 items-center bg-blue-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain rounded" />
                : <Package className="h-4 w-4 text-muted-foreground/40" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate">{item.productName}</p>
              <p className="text-xs text-muted-foreground">{item.variantName}</p>
            </div>
          </div>
          <div className="text-sm text-center">
            {item.originalPriceUsd && parseFloat(item.originalPriceUsd) > parseFloat(item.priceUsd) && (
              <span className="text-xs text-muted-foreground line-through mr-1">{format(parseFloat(item.originalPriceUsd))}</span>
            )}
            <span className="font-medium">{format(parseFloat(item.priceUsd))}</span>
          </div>
          <div className="text-sm text-center text-muted-foreground">×{item.quantity}</div>
          <div className="text-sm text-right font-medium">{format(parseFloat(item.priceUsd) * item.quantity)}</div>
          <div className="flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onRemoveItem(item.variantId, item.bundleId)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
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
}

function CartRow({ item, format, onUpdateQuantity, onRemove }: CartRowProps) {
  const price = parseFloat(item.priceUsd);
  const subtotal = price * item.quantity;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_100px_40px] gap-3 sm:gap-4 px-4 py-4 border-t items-center">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded bg-muted flex items-center justify-center shrink-0">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain rounded" />
          ) : (
            <Package className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.productName}</p>
          <p className="text-xs text-muted-foreground">{item.variantName}</p>
          {item.platform && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.platform}</span>
          )}
        </div>
      </div>
      <div className="text-sm text-center font-medium">{format(price)}</div>
      <div className="flex items-center justify-center">
        <div className="flex items-center border rounded">
          <button className="px-2 py-1 hover:bg-muted transition-colors" onClick={() => onUpdateQuantity(item.variantId, item.quantity - 1, item.bundleId)}>
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="px-3 py-1 text-sm font-medium min-w-[36px] text-center">{item.quantity}</span>
          <button className="px-2 py-1 hover:bg-muted transition-colors" onClick={() => onUpdateQuantity(item.variantId, item.quantity + 1, item.bundleId)}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="text-sm text-right font-semibold">{format(subtotal)}</div>
      <div className="flex justify-end">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onRemove(item.variantId, item.bundleId)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
