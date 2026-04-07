import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderDetail } from "@/components/orders/order-detail";
import { useCurrencyStore } from "@/stores/currency-store";
import { useAuthStore } from "@/stores/auth-store";
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
  const { user, token, isAuthenticated } = useAuthStore();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { format } = useCurrencyStore();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/login");
      return;
    }
    loadOrders();
  }, [token]);

  async function loadOrders() {
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/account/orders`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders);
      } else {
        toast({ title: "Failed to load orders", variant: "destructive" });
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
      const email = user?.email ?? "";
      const res = await fetch(
        `${baseUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        },
      );
      if (res.ok) {
        setSelectedOrder(await res.json());
      } else {
        toast({ title: "Failed to load order details", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load order", variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  }

  if (!isAuthenticated()) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Account", href: "/account" }, { label: "Orders" }]} />

      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">My Orders</h1>
        <p className="text-muted-foreground mb-6">
          View your past orders and license keys.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : selectedOrder ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} className="mb-4">
              &larr; Back to orders
            </Button>
            <OrderDetail
              order={selectedOrder.order}
              items={selectedOrder.items}
              licenseKeys={selectedOrder.licenseKeys}
            />
          </div>
        ) : orders.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            {orders.map((order, idx) => (
              <button
                key={order.id}
                className={`w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-muted/50 transition-colors ${idx > 0 ? "border-t" : ""}`}
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
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No orders found.</p>
          </div>
        )}

        {loadingDetail && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
