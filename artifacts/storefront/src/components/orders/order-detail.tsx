import { useState } from "react";
import { Download, Loader2, Package } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useCurrencyStore } from "@/stores/currency-store";
import { useAuthStore } from "@/stores/auth-store";
import { LicenseKeysDisplay } from "./license-keys";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderTimeline } from "./order-timeline";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface OrderItem {
  id: number;
  variantId?: number;
  productId?: number;
  productName: string;
  variantName: string;
  imageUrl?: string | null;
  priceUsd: string;
  quantity: number;
}

interface KeyGroup {
  orderItemId: number;
  productName: string;
  variantName: string;
  quantity: number;
  instructions?: string | null;
  keys: { id: number; value: string; status: string }[];
}

interface OrderData {
  orderNumber: string;
  status: string;
  subtotalUsd: string;
  discountUsd: string;
  totalUsd: string;
  processingFeeUsd?: string;
  taxAmountUsd?: string;
  taxRate?: string;
  cppAmountUsd?: string;
  paymentMethod: string;
  createdAt: string;
}

interface OrderDetailProps {
  order: OrderData;
  items: OrderItem[];
  licenseKeys: KeyGroup[];
}

export function OrderDetail({ order, items, licenseKeys }: OrderDetailProps) {
  const { format } = useCurrencyStore();
  const token = useAuthStore((s) => s.token);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const subtotal = parseFloat(order.subtotalUsd);
  const discount = parseFloat(order.discountUsd ?? "0");
  const total = parseFloat(order.totalUsd);
  const processingFee = parseFloat(order.processingFeeUsd ?? "0");
  const tax = parseFloat(order.taxAmountUsd ?? "0");
  const taxRate = parseFloat(order.taxRate ?? "0");
  const cpp = parseFloat(order.cppAmountUsd ?? "0");

  const downloadInvoice = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch(`${API}/orders/${order.orderNumber}/invoice.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
        setPdfError(err.error ?? "Failed to generate invoice");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${order.orderNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError("Network error — please try again");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold">Order {order.orderNumber}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Button size="sm" variant="outline" onClick={() => void downloadInvoice()} disabled={pdfLoading} className="gap-1.5">
              {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Invoice PDF
            </Button>
          </div>
          {pdfError && <p className="text-xs text-destructive">{pdfError}</p>}
        </div>
      </div>

      <div className="py-2">
        <OrderTimeline status={order.status} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/30 px-4 py-2 text-sm font-medium grid grid-cols-[1fr_80px_80px_80px] gap-2">
          <span>Product</span>
          <span className="text-right">Price</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Total</span>
        </div>
        {items.map((item) => (
          <div key={item.id} className="px-4 py-3 border-t grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.productName}</p>
                <p className="text-xs text-muted-foreground">{item.variantName}</p>
              </div>
            </div>
            <span className="text-sm text-right">{format(parseFloat(item.priceUsd))}</span>
            <span className="text-sm text-center">{item.quantity}</span>
            <span className="text-sm font-medium text-right">
              {format(parseFloat(item.priceUsd) * item.quantity)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{format(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{format(discount)}</span>
            </div>
          )}
          {cpp > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Protection Plan (CPP)</span>
              <span>+{format(cpp)}</span>
            </div>
          )}
          {processingFee > 0.005 && (
            <div className="flex justify-between text-orange-600">
              <span>Processing fee</span>
              <span>+{format(processingFee)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>VAT {taxRate > 0 ? `(${taxRate.toFixed(0)}%)` : ""}</span>
              <span>+{format(tax)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{format(total)}</span>
          </div>
        </div>
      </div>

      <LicenseKeysDisplay keyGroups={licenseKeys} />
    </div>
  );
}
