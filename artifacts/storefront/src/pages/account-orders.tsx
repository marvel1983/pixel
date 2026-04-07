import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2, Package, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderDetail } from "@/components/orders/order-detail";
import { useCurrencyStore } from "@/stores/currency-store";
import { useToast } from "@/hooks/use-toast";

interface OrderSummary {
  id: number;
  orderNumber: string;
  status: string;
  totalUsd: string;
  paymentMethod: string;
  createdAt: string;
  itemCount: number;
  firstProduct: string;
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

interface OrderItem {
  id: number;
  productName: string;
  variantName: string;
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

interface OrderFull {
  order: OrderData;
  items: OrderItem[];
  licenseKeys: KeyGroup[];
}

export default function AccountOrdersPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { format } = useCurrencyStore();
  const { toast } = useToast();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedOrder(null);

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/account/orders?email=${encodeURIComponent(email.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      }
    } catch {
      toast({ title: "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function openOrder(orderNumber: string) {
    setLoadingDetail(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}`);
      if (res.ok) {
        setSelectedOrder(await res.json());
      }
    } catch {
      toast({ title: "Failed to load order", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Account" }, { label: "Orders" }]} />

      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Order History</h1>
        <p className="text-muted-foreground mb-6">
          View your past orders and license keys.
        </p>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <Input
            placeholder="Enter your email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {selectedOrder ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} className="mb-4">
              ← Back to orders
            </Button>
            <OrderDetail
              order={selectedOrder.order}
              items={selectedOrder.items}
              licenseKeys={selectedOrder.licenseKeys}
            />
          </div>
        ) : (
          <>
            {orders.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                {orders.map((order, idx) => (
                  <button
                    key={order.id}
                    className={`w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-muted/50 transition-colors ${
                      idx > 0 ? "border-t" : ""
                    }`}
                    onClick={() => openOrder(order.orderNumber)}
                  >
                    <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{order.orderNumber}</span>
                        <OrderStatusBadge status={order.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.firstProduct}
                        {order.itemCount > 1 && ` +${order.itemCount - 1} more`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">{format(parseFloat(order.totalUsd))}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {searched && !loading && orders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No orders found for this email address.</p>
              </div>
            )}

            {loadingDetail && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
