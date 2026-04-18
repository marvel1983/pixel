import { useEffect, useState } from "react";
import { Package, Minus, Plus, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useCurrencyStore, BASE_CURRENCY } from "@/stores/currency-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
interface CheckoutSummaryProps {
  cppSelected: boolean;
  cppPrice?: number;
  taxRate?: number;
  taxLabel?: string;
  priceDisplay?: string;
  gcDeduction?: number;
  loyaltyDiscount?: number;
  servicesTotal?: number;
  processingFee?: number;
  processingFeeLabel?: string;
}

export function CheckoutSummary({ cppSelected, cppPrice = 0, taxRate = 0, taxLabel = "VAT", priceDisplay = "exclusive", gcDeduction = 0, loyaltyDiscount = 0, servicesTotal = 0, processingFee = 0, processingFeeLabel }: CheckoutSummaryProps) {
  const loyaltyConfig = useLoyaltyStore((s) => s.config);
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const getTotal = useCartStore((s) => s.getTotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const { format, code: currencyCode } = useCurrencyStore();

  const subtotal = getTotal();
  const discountAmount = coupon ? subtotal * (coupon.pct / 100) : 0;
  const cppAmount = cppSelected ? cppPrice : 0;
  const beforeTax = subtotal - discountAmount - loyaltyDiscount + cppAmount + servicesTotal + processingFee;
  const isInclusive = priceDisplay === "inclusive";
  const taxAmount = taxRate > 0
    ? isInclusive
      ? Math.round((beforeTax - beforeTax / (1 + taxRate / 100)) * 100) / 100
      : Math.round(beforeTax * (taxRate / 100) * 100) / 100
    : 0;
  const preGcTotal = isInclusive ? beforeTax : beforeTax + taxAmount;
  const total = Math.max(0, preGcTotal - gcDeduction);

  return (
    <div className="border rounded-lg p-5 space-y-4 bg-muted/10">
      <h3 className="text-lg font-bold">Order Summary</h3>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {items.map((item) => {
          const price = parseFloat(item.priceUsd);
          const stock = item.stockCount ?? 0;
          const backorderQty = item.backorderAllowed ? Math.max(0, item.quantity - stock) : 0;
          const inStockQty = Math.min(item.quantity, stock);
          return (
            <div key={`${item.bundleId ?? 's'}-${item.variantId}`} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 mt-0.5">
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
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1, item.bundleId)}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-xs w-5 text-center">{item.quantity}</span>
                  <button
                    className="w-5 h-5 rounded border flex items-center justify-center hover:bg-muted"
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1, item.bundleId)}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                {backorderQty > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700 rounded px-1.5 py-0.5">
                    <Clock className="h-2.5 w-2.5 shrink-0" />
                    {inStockQty > 0
                      ? <span><b>{inStockQty}</b> in stock · <b>{backorderQty}</b> on backorder{item.backorderEta ? ` (est. ${item.backorderEta})` : ""}</span>
                      : <span><b>{backorderQty}</b> on backorder{item.backorderEta ? ` · est. ${item.backorderEta}` : ""}</span>
                    }
                  </div>
                )}
              </div>
              <span className="text-sm font-medium shrink-0">{format(price * item.quantity)}</span>
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

        {loyaltyDiscount > 0 && (
          <div className="flex justify-between text-yellow-600">
            <span>Loyalty Points</span>
            <span>-{format(loyaltyDiscount)}</span>
          </div>
        )}

        {cppSelected && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Protection (CPP)</span>
            <span>{format(cppAmount)}</span>
          </div>
        )}

        {servicesTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Add-on Services</span>
            <span>{format(servicesTotal)}</span>
          </div>
        )}

        {processingFee > 0 && (
          <div className="flex justify-between text-orange-600">
            <span>{processingFeeLabel ?? "Processing fee"}</span>
            <span>+{format(processingFee)}</span>
          </div>
        )}

        {taxAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{isInclusive ? `Incl. ${taxLabel}` : taxLabel} ({taxRate}%)</span>
            <span>{isInclusive ? "" : "+"}{format(taxAmount)}</span>
          </div>
        )}
        {gcDeduction > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Gift Card</span>
            <span>-{format(gcDeduction)}</span>
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

      {loyaltyConfig?.enabled && loyaltyConfig.pointsPerDollar > 0 && total > 0 && (
        <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium mt-1">
          🎯 You'll earn ~{Math.floor(total * loyaltyConfig.pointsPerDollar).toLocaleString()} points with this order
        </p>
      )}
    </div>
  );
}
