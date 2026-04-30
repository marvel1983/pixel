import { useEffect } from "react";
import { Link } from "wouter";
import { X, ShoppingBag, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useCartDrawerStore } from "@/stores/cart-drawer-store";
import { useCurrencyStore } from "@/stores/currency-store";

export function CartDrawer() {
  const isOpen = useCartDrawerStore((s) => s.isOpen);
  const close = useCartDrawerStore((s) => s.close);
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const format = useCurrencyStore((s) => s.format);

  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.priceUsd) * item.quantity, 0);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={close}
        aria-hidden="true"
      />

      <div
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-background shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            <span className="font-semibold">Cart ({items.length})</span>
          </div>
          <button
            onClick={close}
            aria-label="Close cart"
            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3 py-12">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/30" aria-hidden />
              <p className="text-muted-foreground text-sm">Your cart is empty</p>
              <Button size="sm" variant="outline" onClick={close} asChild>
                <Link href="/shop">Browse products</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((item) => (
                <div key={`${item.variantId}-${item.bundleId ?? 0}`} className="flex gap-3 px-4 py-3">
                  <div className="w-14 h-14 shrink-0 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-contain" />
                      : <Package className="h-5 w-5 text-muted-foreground/30" aria-hidden />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.variantName}</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {format(parseFloat(item.priceUsd))} × {item.quantity}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(item.variantId, item.bundleId)}
                    aria-label={`Remove ${item.productName}`}
                    className="shrink-0 h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t px-4 py-4 space-y-3 shrink-0 bg-background">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-base font-bold">{format(subtotal)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={close} asChild>
                <Link href="/cart">View Cart</Link>
              </Button>
              <Button size="sm" onClick={close} asChild>
                <Link href="/checkout">Checkout</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
