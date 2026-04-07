import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyCart() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <ShoppingCart className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {t("cart.empty")}
      </h2>
      <p className="text-muted-foreground text-sm mb-6 max-w-sm">
        {t("cart.emptyDesc")}
      </p>
      <Link href="/shop">
        <Button size="lg">{t("cart.returnToShop")}</Button>
      </Link>
    </div>
  );
}
