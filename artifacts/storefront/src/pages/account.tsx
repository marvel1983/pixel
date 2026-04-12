import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { User, ShoppingBag, Heart, Star, Gift, Link2, Mail, Loader2, Shield, Trophy, Headphones, Wallet, Award } from "lucide-react";
import { GiftCardsTab } from "@/components/account/gift-cards-tab";
import { AffiliateTab } from "@/components/account/affiliate-tab";
import { NewsletterTab } from "@/components/account/newsletter-tab";
import { ConnectedAccountsTab } from "@/components/account/connected-accounts";
import { RewardsTab } from "@/components/account/rewards-tab";
import { LoyaltyDashboard } from "@/components/account/loyalty-dashboard";
import { SupportTab } from "@/components/account/support-tab";
import { WalletTab } from "@/components/account/wallet-tab";
import { useWalletBalance } from "@/hooks/use-wallet-balance";

function ProfileStoreCreditCard() {
  const { t } = useTranslation();
  const { balance, loading, loadFailed, refresh } = useWalletBalance();
  return (
    <Card className="mb-6 border-primary/15 bg-muted/30">
      <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("accountPage.storeCreditTitle")}</p>
            {loadFailed && !loading ? (
              <div className="mt-1 space-y-2">
                <p className="text-sm text-destructive">{t("wallet.dataLoadFailed")}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
                  {t("wallet.retry")}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {loading && balance === null ? "…" : `$${(balance ?? 0).toFixed(2)}`}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("accountPage.storeCreditHint")}</p>
              </>
            )}
          </div>
        </div>
        <Link href="/account/balance">
          <Button variant="secondary" className="w-full sm:w-auto">{t("accountPage.storeCreditManage")}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ProfileLoyaltyCard() {
  const { t } = useTranslation();
  const { token } = useAuthStore();
  const [points, setPoints] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLoyalty() {
      try {
        const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
        const res = await fetch(`${baseUrl}/loyalty/account`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (res.ok) {
          const d = await res.json();
          if (d.enabled) {
            setPoints(d.pointsBalance);
            setTier(d.tier);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadLoyalty();
  }, [token]);

  if (!loading && points === null) return null;

  return (
    <Card className="mb-4 border-primary/15 bg-muted/30">
      <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("accountPage.loyaltyTitle", { defaultValue: "Loyalty Rewards" })}</p>
            {loading ? (
              <p className="text-2xl font-bold tabular-nums">…</p>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">
                  {(points ?? 0).toLocaleString()} <span className="text-base font-normal text-muted-foreground">pts</span>
                </p>
                {tier && (
                  <p className="text-xs text-muted-foreground mt-0.5">{tier} tier</p>
                )}
              </>
            )}
          </div>
        </div>
        <Link href="/account/loyalty">
          <Button variant="secondary" className="w-full sm:w-auto">View Rewards</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

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
  const [birthday, setBirthday] = useState("");
  const [savingBirthday, setSavingBirthday] = useState(false);

  useEffect(() => {
    if (!token) return;
    const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
    fetch(`${baseUrl}/loyalty/birthday`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.dateOfBirth) setBirthday(d.dateOfBirth.slice(0, 10));
      })
      .catch(() => {});
  }, [token]);

  async function handleSaveBirthday() {
    if (!birthday) return;
    setSavingBirthday(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/loyalty/birthday`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ dateOfBirth: birthday }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Birthday saved!" });
    } catch {
      toast({ title: "Failed to save birthday", variant: "destructive" });
    } finally {
      setSavingBirthday(false);
    }
  }

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
    <div className="space-y-0">
      <ProfileStoreCreditCard />
      <ProfileLoyaltyCard />
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

        <div className="border-t mt-6 pt-6">
          <div className="max-w-md">
            <Label htmlFor="birthday">Birthday</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Set your birthday to receive bonus points on your special day!
            </p>
            <div className="flex gap-2">
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveBirthday}
                disabled={savingBirthday || !birthday}
              >
                {savingBirthday ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </div>
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
          <TabsTrigger value="loyalty" className="gap-1.5">
            <Award className="h-4 w-4" /> Loyalty
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
        <TabsContent value="loyalty"><LoyaltyDashboard /></TabsContent>
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
