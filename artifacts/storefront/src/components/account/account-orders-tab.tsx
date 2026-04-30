import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { OrderDetail } from "@/components/orders/order-detail";

interface OrderSummary {
  orderNumber: string;
  status: string;
  totalUsd: string;
  createdAt: string;
  itemCount: number;
  firstProduct: string;
}

export function AccountOrdersTab() {
  const { t } = useTranslation();
  const { token, user } = useAuthStore();
  const format = useCurrencyStore((s) => s.format);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
        const res = await fetch(`${baseUrl}/account/orders`, {
          headers: { Authorization: `Bearer ${token}` }, credentials: "include",
        });
        if (res.ok) { const data = await res.json(); setOrders(data.orders); }
      } catch { /* ignore */ } finally { setLoading(false); }
    }
    load();
  }, [token]);

  async function openOrder(orderNumber: string) {
    setLoadingDetail(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const email = user?.email ?? "";
      const res = await fetch(`${baseUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: "include",
      });
      if (res.ok) setSelectedOrder(await res.json());
    } catch { /* ignore */ } finally { setLoadingDetail(false); }
  }

  if (loading) return (
    <Card aria-busy="true" aria-label="Loading orders">
      <CardContent className="py-4 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 border rounded-lg p-4">
            <Skeleton className="h-10 w-10 rounded-md shrink-0" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-52" /></div>
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (selectedOrder) return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} className="mb-4">&larr; {t("accountPage.backToOrders")}</Button>
      <OrderDetail
        order={(selectedOrder as any).order}
        items={(selectedOrder as any).items}
        licenseKeys={(selectedOrder as any).licenseKeys}
      />
    </div>
  );

  if (orders.length === 0) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">
      <ShoppingBag className="h-8 w-8 mx-auto mb-3" />
      <p>{t("accountPage.noOrdersYet")}</p>
    </CardContent></Card>
  );

  return (
    <Card>
      <CardContent className="p-0">
        {loadingDetail && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        <div className="divide-y">
          {orders.map((o) => (
            <button key={o.orderNumber} onClick={() => openOrder(o.orderNumber)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition text-left">
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {o.firstProduct} {o.itemCount > 1 ? t("accountPage.moreItems", { count: o.itemCount - 1 }) : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{format(parseFloat(o.totalUsd))}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
