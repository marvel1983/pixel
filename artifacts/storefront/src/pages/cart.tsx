import { useTranslation } from "react-i18next";
import { useCartStore } from "@/stores/cart-store";
import { CartProgress } from "@/components/cart/cart-progress";
import { CartItemsTable } from "@/components/cart/cart-items-table";
import { CartTotals } from "@/components/cart/cart-totals";
import { EmptyCart } from "@/components/cart/empty-cart";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";

export default function CartPage() {
  const { t } = useTranslation();
  const items = useCartStore((s) => s.items);
  const isEmpty = items.length === 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("cart.title") }]} />
      <CartProgress step={1} />

      {isEmpty ? (
        <EmptyCart />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <CartItemsTable />
          <CartTotals />
        </div>
      )}
    </div>
  );
}
