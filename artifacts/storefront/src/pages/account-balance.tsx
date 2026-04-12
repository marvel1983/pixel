import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { WalletTab } from "@/components/account/wallet-tab";
import { useAuthStore } from "@/stores/auth-store";

export default function AccountBalancePage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated()) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated()) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { label: t("account.title"), href: "/account" },
          { label: t("wallet.balancePageTitle") },
        ]}
      />
      <h1 className="text-2xl font-bold mt-4 mb-2">{t("wallet.balancePageTitle")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t("wallet.balancePageSubtitle")}</p>
      <WalletTab />
    </div>
  );
}
