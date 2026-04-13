import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2, Package, ChevronRight, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderDetail } from "@/components/orders/order-detail";
import { useCurrencyStore } from "@/stores/currency-store";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
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
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  imageUrl: string | null;
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

// ── Buy Again button ────────────────────────────────────────────────────────

interface BuyAgainButtonProps {
  orderNumber: string;
  cachedItems: OrderItem[] | undefined;
  onFetchItems: (orderNumber: string) => Promise<OrderItem[]>;
}

function BuyAgainButton({ orderNumber, cachedItems, onFetchItems }: BuyAgainButtonProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleBuyAgain(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      const items = cachedItems ?? await onFetchItems(orderNumber);
      items.forEach((item) => {
        if (item.variantId > 0) {
          addItem({
            variantId: item.variantId,
            productId: item.productId,
            productName: item.productName,
            variantName: item.variantName,
            imageUrl: item.imageUrl,
            priceUsd: item.priceUsd,
          });
        }
      });
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleBuyAgain}
      disabled={loading}
      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors disabled:opacity-60 ${
        done
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-background border-border text-foreground hover:bg-muted"
      }`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : done ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0" />
          Added!
        </>
      ) : (
        <>
          <ShoppingCart className="h-3.5 w-3.5 shrink-0" />
          Buy Again
        </>
      )}
    </button>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function AccountOrdersPage() {
  const { t } = useTranslation();
  const { user, token, isAuthenticated } = useAuthStore();
  const [, setLocation] = useLocation();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Cache of fetched order items keyed by orderNumber (for Buy Again)
  const [itemsCache, setItemsCache] = useState<Record<string, OrderItem[]>>({});
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
        toast({ title: t("accountPage.failedToLoad"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("accountPage.failedToLoad"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrderFull(orderNumber: string): Promise<OrderFull | null> {
    const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
    const email = user?.email ?? "";
    const res = await fetch(
      `${baseUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      },
    );
    if (!res.ok) return null;
    return res.json();
  }

  async function openOrder(orderNumber: string) {
    setLoadingDetail(true);
    try {
      const data = await fetchOrderFull(orderNumber);
      if (data) {
        setSelectedOrder(data);
        // Cache items for potential Buy Again use
        setItemsCache((prev) => ({ ...prev, [orderNumber]: data.items }));
      } else {
        toast({ title: t("accountPage.failedToLoadDetails"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("accountPage.failedToLoad"), variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  }

  async function fetchItemsForBuyAgain(orderNumber: string): Promise<OrderItem[]> {
    try {
      const data = await fetchOrderFull(orderNumber);
      if (data) {
        setItemsCache((prev) => ({ ...prev, [orderNumber]: data.items }));
        return data.items;
      }
    } catch {
      toast({ title: t("accountPage.failedToLoad"), variant: "destructive" });
    }
    return [];
  }

  if (!isAuthenticated()) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("account.title"), href: "/account" }, { label: t("account.orders") }]} />

      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">{t("accountPage.myOrders")}</h1>
        <p className="text-muted-foreground mb-6">
          {t("accountPage.viewOrdersDesc")}
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : selectedOrder ? (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} className="mb-4">
              &larr; {t("accountPage.backToOrders")}
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
              <div
                key={order.id}
                className={`px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors ${idx > 0 ? "border-t" : ""}`}
              >
                {/* Clickable area opens detail view */}
                <button
                  className="flex flex-1 items-center gap-3 text-left min-w-0"
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
                      {order.itemCount > 1 && ` ${t("accountPage.moreItems", { count: order.itemCount - 1 })}`}
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

                {/* Buy Again — only for completed orders */}
                {order.status === "COMPLETED" && (
                  <BuyAgainButton
                    orderNumber={order.orderNumber}
                    cachedItems={itemsCache[order.orderNumber]}
                    onFetchItems={fetchItemsForBuyAgain}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t("accountPage.noOrdersFound")}</p>
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
