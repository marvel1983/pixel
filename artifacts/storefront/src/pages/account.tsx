import { Component, type ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/auth-store";
import { useWishlistStore } from "@/stores/wishlist-store";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { User, ShoppingBag, Heart, Star, Gift, Link2, Mail, Shield, Trophy, Headphones, Wallet, Award } from "lucide-react";
import { GiftCardsTab } from "@/components/account/gift-cards-tab";
import { AffiliateTab } from "@/components/account/affiliate-tab";
import { NewsletterTab } from "@/components/account/newsletter-tab";
import { ConnectedAccountsTab } from "@/components/account/connected-accounts";
import { RewardsTab } from "@/components/account/rewards-tab";
import { LoyaltyDashboard } from "@/components/account/loyalty-dashboard";
import { SupportTab } from "@/components/account/support-tab";
import { WalletTab } from "@/components/account/wallet-tab";
import { ProfileTab } from "@/components/account/profile-tab";
import { AccountOrdersTab } from "@/components/account/account-orders-tab";

class TabErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">Something went wrong loading this tab.</p>
            <p className="text-xs text-muted-foreground font-mono">{this.state.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>Try again</Button>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

const PlaceholderTab = ({ emptyKey, icon }: { emptyKey: string; icon: ReactNode }) => {
  const { t } = useTranslation();
  return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">
      <div className="flex justify-center mb-3">{icon}</div>
      <p>{t(emptyKey)}</p>
    </CardContent></Card>
  );
};

function AccountWishlistTab() {
  const { t } = useTranslation();
  const { productIds } = useWishlistStore();
  const count = productIds.length;
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-4">
        <div className="flex justify-center"><Heart className="h-10 w-10 text-muted-foreground" /></div>
        <p className="text-muted-foreground">
          {count === 0 ? t("wishlist.empty") : t("accountPage.wishlistTabHint", { count })}
        </p>
        <Button asChild variant="secondary"><Link href="/wishlist">{t("wishlist.myWishlist")}</Link></Button>
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [, setLocation] = useLocation();
  const initialTab = new URLSearchParams(window.location.search).get("tab") || "profile";

  useEffect(() => { if (!isAuthenticated()) setLocation("/login"); }, [isAuthenticated, setLocation]);
  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("account.title") }]} />
      <h1 className="text-2xl font-bold mt-4 mb-6">{t("accountPage.welcome", { name: user.firstName ?? user.email })}</h1>
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="profile" className="gap-1.5"><User className="h-4 w-4" /> {t("accountPage.profile")}</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingBag className="h-4 w-4" /> {t("accountPage.orders")}</TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5"><Trophy className="h-4 w-4" /> {t("accountPage.rewards")}</TabsTrigger>
          <TabsTrigger value="loyalty" className="gap-1.5"><Award className="h-4 w-4" /> Loyalty</TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5"><Shield className="h-4 w-4" /> {t("accountPage.connected")}</TabsTrigger>
          <TabsTrigger value="wishlist" className="gap-1.5"><Heart className="h-4 w-4" /> {t("accountPage.wishlist")}</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5"><Star className="h-4 w-4" /> {t("accountPage.reviews")}</TabsTrigger>
          <TabsTrigger value="gift-cards" className="gap-1.5"><Gift className="h-4 w-4" /> {t("accountPage.giftCards")}</TabsTrigger>
          <TabsTrigger value="affiliate" className="gap-1.5"><Link2 className="h-4 w-4" /> {t("accountPage.affiliate")}</TabsTrigger>
          <TabsTrigger value="newsletter" className="gap-1.5"><Mail className="h-4 w-4" /> {t("accountPage.newsletter")}</TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1.5"><Wallet className="h-4 w-4" /> {t("accountPage.wallet")}</TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5"><Headphones className="h-4 w-4" /> {t("accountPage.support")}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><TabErrorBoundary><ProfileTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="orders"><TabErrorBoundary><AccountOrdersTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="rewards"><TabErrorBoundary><RewardsTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="loyalty"><TabErrorBoundary><LoyaltyDashboard /></TabErrorBoundary></TabsContent>
        <TabsContent value="connected"><TabErrorBoundary><ConnectedAccountsTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="wishlist"><TabErrorBoundary><AccountWishlistTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="reviews"><TabErrorBoundary><PlaceholderTab emptyKey="accountPage.reviewsEmpty" icon={<Star className="h-8 w-8" />} /></TabErrorBoundary></TabsContent>
        <TabsContent value="gift-cards"><TabErrorBoundary><GiftCardsTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="affiliate"><TabErrorBoundary><AffiliateTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="newsletter"><TabErrorBoundary><NewsletterTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="wallet"><TabErrorBoundary><WalletTab /></TabErrorBoundary></TabsContent>
        <TabsContent value="support"><TabErrorBoundary><SupportTab /></TabErrorBoundary></TabsContent>
      </Tabs>
    </div>
  );
}
