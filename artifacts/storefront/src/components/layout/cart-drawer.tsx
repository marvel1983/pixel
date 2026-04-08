import { Link } from "wouter";
import { useMemo } from "react";
import { X, Plus, Minus, Trash2, ShoppingBag, AlertTriangle } from "lucide-react";
import { hasRegionMismatch, detectCountryFromLocale } from "@/components/cart/region-warning";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useCartStore, type CartItem } from "@/stores/cart-store";
import { useCurrencyStore } from "@/stores/currency-store";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const items = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.getTotal());
  const clearCart = useCartStore((s) => s.clearCart);
  const format = useCurrencyStore((s) => s.format);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopping Cart ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
            <div>
              <p className="font-medium text-foreground">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add some products to get started
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-4 py-4">
              <CartDrawerRegionWarning items={items} />
              {items.map((item) => (
                <CartItemRow key={`${item.bundleId ?? 's'}-${item.variantId}`} item={item} />
              ))}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{format(total)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{format(total)}</span>
              </div>
              <Link href="/checkout" onClick={onClose}>
                <Button className="w-full" size="lg">
                  Proceed to Checkout
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={clearCart}
              >
                Clear Cart
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartDrawerRegionWarning({ items }: { items: CartItem[] }) {
  const country = useMemo(() => detectCountryFromLocale(), []);
  const mismatched = items.filter(
    (i) => i.regionRestrictions && i.regionRestrictions.length > 0 && hasRegionMismatch(i.regionRestrictions, country)
  );
  if (mismatched.length === 0) return null;
  return (
    <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 rounded-lg p-2.5 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="text-xs text-amber-700 dark:text-amber-300">
        <p className="font-medium">Region mismatch detected:</p>
        <ul className="mt-1 space-y-0.5">
          {mismatched.map((i) => (
            <li key={`${i.bundleId ?? "s"}-${i.variantId}`}>
              {i.productName} — <span className="text-amber-500">{i.regionRestrictions?.join(", ")} only</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-amber-600 dark:text-amber-400">These keys may not activate in your region.</p>
      </div>
    </div>
  );
}

function CartItemRow({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const format = useCurrencyStore((s) => s.format);
  const lineTotal = parseFloat(item.priceUsd) * item.quantity;

  return (
    <div className="flex gap-3">
      <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            className="w-full h-full object-cover"
          />
        ) : (
          <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.productName}</p>
        <p className="text-xs text-muted-foreground">{item.variantName}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => updateQuantity(item.variantId, item.quantity - 1, item.bundleId)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm w-6 text-center">{item.quantity}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-6 w-6"
              onClick={() => updateQuantity(item.variantId, item.quantity + 1, item.bundleId)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{format(lineTotal)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(item.variantId, item.bundleId)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
