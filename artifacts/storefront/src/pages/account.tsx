import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { User, ShoppingBag, Heart, Star, Gift, Link2, Mail, Loader2, Shield, Trophy, Headphones, Wallet } from "lucide-react";
import { GiftCardsTab } from "@/components/account/gift-cards-tab";
import { AffiliateTab } from "@/components/account/affiliate-tab";
import { NewsletterTab } from "@/components/account/newsletter-tab";
import { ConnectedAccountsTab } from "@/components/account/connected-accounts";
import { RewardsTab } from "@/components/account/rewards-tab";
import { SupportTab } from "@/components/account/support-tab";
import { WalletTab } from "@/components/account/wallet-tab";

function ProfileTab() {
  const { t } = useTranslation();
  const { user, token, setAuth } = useAuthStore();
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const body: Record<string, string> = {};
      if (form.firstName) body.firstName = form.firstName;
      if (form.lastName) body.lastName = form.lastName;
      if (form.newPassword) {
        body.currentPassword = form.currentPassword;
        body.newPassword = form.newPassword;
      }

      const res = await fetch(`${baseUrl}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("accountPage.updateFailed"));

      setAuth(data.user, token!);
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
      toast({ title: t("accountPage.profileUpdated") });
    } catch (err) {
      toast({
        title: t("accountPage.updateFailed"),
        description: err instanceof Error ? err.message : t("checkout.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("accountPage.profileInfo")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <Label>{t("auth.email")}</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">{t("auth.firstName")}</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lastName">{t("auth.lastName")}</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium mb-3">{t("accountPage.changePassword")}</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="currentPassword">{t("accountPage.currentPassword")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => update("currentPassword", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newPassword">{t("accountPage.newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={form.newPassword}
                  onChange={(e) => update("newPassword", e.target.value)}
                  minLength={8}
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t("accountPage.saveChanges")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get("tab") || "profile";

  useEffect(() => {
    if (!isAuthenticated()) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("account.title") }]} />

      <h1 className="text-2xl font-bold mt-4 mb-6">
        {t("accountPage.welcome", { name: user.firstName ?? user.email })}
      </h1>

      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" /> {t("accountPage.profile")}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" /> {t("accountPage.orders")}
          </TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5">
            <Trophy className="h-4 w-4" /> {t("accountPage.rewards")}
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5">
            <Shield className="h-4 w-4" /> {t("accountPage.connected")}
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="gap-1.5">
            <Heart className="h-4 w-4" /> {t("accountPage.wishlist")}
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            <Star className="h-4 w-4" /> {t("accountPage.reviews")}
          </TabsTrigger>
          <TabsTrigger value="gift-cards" className="gap-1.5">
            <Gift className="h-4 w-4" /> {t("accountPage.giftCards")}
          </TabsTrigger>
          <TabsTrigger value="affiliate" className="gap-1.5">
            <Link2 className="h-4 w-4" /> {t("accountPage.affiliate")}
          </TabsTrigger>
          <TabsTrigger value="newsletter" className="gap-1.5">
            <Mail className="h-4 w-4" /> {t("accountPage.newsletter")}
          </TabsTrigger>
          <TabsTrigger value="wallet" className="gap-1.5">
            <Wallet className="h-4 w-4" /> {t("accountPage.wallet")}
          </TabsTrigger>
          <TabsTrigger value="support" className="gap-1.5">
            <Headphones className="h-4 w-4" /> {t("accountPage.support")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="orders"><AccountOrdersTab /></TabsContent>
        <TabsContent value="rewards"><RewardsTab /></TabsContent>
        <TabsContent value="connected"><ConnectedAccountsTab /></TabsContent>
        <TabsContent value="wishlist"><PlaceholderTab titleKey="accountPage.wishlist" icon={<Heart className="h-8 w-8" />} /></TabsContent>
        <TabsContent value="reviews"><PlaceholderTab titleKey="accountPage.reviews" icon={<Star className="h-8 w-8" />} /></TabsContent>
        <TabsContent value="gift-cards"><GiftCardsTab /></TabsContent>
        <TabsContent value="affiliate"><AffiliateTab /></TabsContent>
        <TabsContent value="newsletter"><NewsletterTab /></TabsContent>
        <TabsContent value="wallet"><WalletTab /></TabsContent>
        <TabsContent value="support"><SupportTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const PlaceholderTab = ({ titleKey, icon }: { titleKey: string; icon: React.ReactNode }) => {
  const { t } = useTranslation();
  return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">
      <div className="flex justify-center mb-3">{icon}</div>
      <p>{t("accountPage.noOrdersYet")}</p>
    </CardContent></Card>
  );
};

function AccountOrdersTab() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
        const res = await fetch(`${baseUrl}/account/orders`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  if (orders.length === 0) return (
    <Card><CardContent className="py-12 text-center text-muted-foreground">
      <ShoppingBag className="h-8 w-8 mx-auto mb-3" />
      <p>{t("accountPage.noOrdersYet")}</p>
    </CardContent></Card>
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {orders.map((o) => (
            <a key={o.orderNumber} href="/order-lookup" className="flex items-center justify-between p-4 hover:bg-muted/50 transition">
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {o.firstProduct} {o.itemCount > 1 ? t("accountPage.moreItems", { count: o.itemCount - 1 }) : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${o.totalUsd}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</p>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface OrderSummary {
  orderNumber: string;
  status: string;
  totalUsd: string;
  createdAt: string;
  itemCount: number;
  firstProduct: string;
}
