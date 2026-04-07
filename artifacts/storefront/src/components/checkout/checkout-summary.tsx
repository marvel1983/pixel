import { Package, Minus, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore, BASE_CURRENCY } from "@/stores/currency-store";
import { getCppAmount } from "./cpp-section";

interface CheckoutSummaryProps {
  cppSelected: boolean;
}

export function CheckoutSummary({ cppSelected }: CheckoutSummaryProps) {
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const getTotal = useCartStore((s) => s.getTotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const { format, code: currencyCode } = useCurrencyStore();

  const subtotal = getTotal();
  const discountAmount = coupon ? subtotal * (coupon.pct / 100) : 0;
  const cppAmount = cppSelected ? getCppAmount(subtotal) : 0;
  const total = subtotal - discountAmount + cppAmount;

  return (
    <div className="border rounded-lg p-5 space-y-4 bg-muted/10 sticky top-24">
      <h3 className="text-lg font-bold">Order Summary</h3>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {items.map((item) => {
          const price = parseFloat(item.priceUsd);
          return (
            <div key={item.variantId} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="w-full h-full object-contain rounded" />
                ) : (
                  <Package className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.productName}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <button
                    className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted"
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-xs w-5 text-center">{item.quantity}</span>
                  <button
                    className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted"
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <span className="text-sm font-medium">{format(price * item.quantity)}</span>
            </div>
          );
        })}
      </div>

      <Separator />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{format(subtotal)}</span>
        </div>

        {coupon && (
          <div className="flex justify-between text-green-600">
            <span>Discount ({coupon.label})</span>
            <span>-{format(discountAmount)}</span>
          </div>
        )}

        {cppSelected && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protection (CPP)</span>
            <span>{format(cppAmount)}</span>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex justify-between font-bold text-lg">
        <span>Total</span>
        <span>{format(total)}</span>
      </div>

      {currencyCode !== BASE_CURRENCY && (
        <p className="text-xs text-muted-foreground text-center">
          Payment processed in {BASE_CURRENCY}. Displayed price is approximate.
        </p>
      )}
    </div>
  );
}
