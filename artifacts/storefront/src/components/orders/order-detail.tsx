import { Download, Package } from "lucide-react";
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
  keys: { id: number; value: string; status: string }[];
}

interface OrderData {
  orderNumber: string;
  status: string;
  subtotalUsd: string;
  discountUsd: string;
  totalUsd: string;
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
  const subtotal = parseFloat(order.subtotalUsd);

  const downloadInvoice = async () => {
    const res = await fetch(`${API}/orders/${order.orderNumber}/invoice.pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${order.orderNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const discount = parseFloat(order.discountUsd);
  const total = parseFloat(order.totalUsd);

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
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <Button size="sm" variant="outline" onClick={() => void downloadInvoice()} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Invoice PDF
          </Button>
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
        <div className="w-64 space-y-2 text-sm">
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
