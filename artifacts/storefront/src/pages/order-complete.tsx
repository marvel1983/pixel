import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { Download, ArrowRight, Loader2 } from "lucide-react";
import { AnimatedCheckmark } from "@/components/order/animated-checkmark";
import { Confetti } from "@/components/order/confetti";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CartProgress } from "@/components/cart/cart-progress";
import { OrderDetail } from "@/components/orders/order-detail";
import { useAuthStore } from "@/stores/auth-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useCartStore } from "@/stores/cart-store";

interface OrderResponse {
  order: {
    orderNumber: string;
    status: string;
    subtotalUsd: string;
    discountUsd: string;
    totalUsd: string;
    paymentMethod: string;
    createdAt: string;
  };
  items: {
    id: number;
    productName: string;
    variantName: string;
    priceUsd: string;
    quantity: number;
  }[];
  licenseKeys: {
    orderItemId: number;
    productName: string;
    variantName: string;
    quantity: number;
    keys: { id: number; value: string; status: string }[];
  }[];
}

export default function OrderCompletePage() {
  const { t } = useTranslation();
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber ?? "";
  const [data, setData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthStore();
  const loyaltyConfig = useLoyaltyStore((s) => s.config);
  const clearCart = useCartStore((s) => s.clearCart);

  useEffect(() => {
    clearCart();
  }, []);

  useEffect(() => {
    if (!orderNumber) return;
    const storedEmail = sessionStorage.getItem("checkout_email");
    if (!storedEmail) {
      setLoading(false);
      return;
    }
    const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
    fetch(`${baseUrl}/orders/${orderNumber}?email=${encodeURIComponent(storedEmail)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderNumber]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { label: "Cart", href: "/cart" },
          { label: t("orderComplete.checkout"), href: "/checkout" },
          { label: t("orderComplete.orderComplete") },
        ]}
      />
      <CartProgress step={3} />

      <div className="max-w-2xl mx-auto py-8">
        <Confetti />
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mx-auto mb-4">
            <AnimatedCheckmark />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("order.confirmed")}</h1>
          <p className="text-muted-foreground">
            {t("order.thankYou")}
          </p>
          {isAuthenticated() && loyaltyConfig?.enabled && data?.order?.subtotalUsd && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 px-4 py-2 text-green-700 dark:text-green-400 text-sm font-medium">
              🎯 You earned approximately{" "}
              {Math.floor(
                parseFloat(data.order.subtotalUsd) * loyaltyConfig.pointsPerDollar
              ).toLocaleString()}{" "}
              points for this order!
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && data && (
          <OrderDetail
            order={data.order}
            items={data.items}
            licenseKeys={data.licenseKeys}
          />
        )}

        {!loading && !data && (
          <div className="border rounded-lg p-5 mb-6 text-left">
            <p className="text-sm font-medium mb-1">
              {t("order.orderNumber")}: <span className="text-primary">{orderNumber}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("order.keysDelivery")}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link href="/shop">
            <Button>
              <ArrowRight className="h-4 w-4 mr-2" />
              {t("order.continueShopping")}
            </Button>
          </Link>
          <Link href="/order-lookup">
            <Button variant="secondary">{t("order.checkStatus")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
