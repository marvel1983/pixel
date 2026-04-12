import { useEffect } from "react";
import { useLocation } from "wouter";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { LoyaltyDashboard } from "@/components/account/loyalty-dashboard";
import { useAuthStore } from "@/stores/auth-store";

export default function AccountLoyaltyPage() {
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
          { label: "Account", href: "/account" },
          { label: "Loyalty Rewards" },
        ]}
      />
      <h1 className="text-2xl font-bold mt-4 mb-2">Loyalty Rewards</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Track your points, tier status, and transaction history.
      </p>
      <LoyaltyDashboard />
    </div>
  );
}
