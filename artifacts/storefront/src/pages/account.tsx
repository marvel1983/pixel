import { useState, useEffect, Component, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BILLING_COUNTRIES } from "@/components/checkout/billing-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { useWishlistStore } from "@/stores/wishlist-store";
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
import { OrderDetail } from "@/components/orders/order-detail";

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

const EMAIL_PREFS_KEY = "email_preferences";

interface EmailPrefs {
  shippingUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
}

function loadEmailPrefs(): EmailPrefs {
  try {
    const raw = localStorage.getItem(EMAIL_PREFS_KEY);
    if (raw) return JSON.parse(raw) as EmailPrefs;
  } catch {
    // ignore
  }
  return { shippingUpdates: true, promotions: true, newsletter: false };
}

function EmailPreferencesSection() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<EmailPrefs>(loadEmailPrefs);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof EmailPrefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify(prefs));
    setSaved(true);
    toast({ title: "Email preferences saved!" });
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Email Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Order confirmations</p>
            <p className="text-xs text-muted-foreground">Receive a confirmation when you place an order</p>
          </div>
          <Switch checked disabled aria-label="Order confirmations" />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Shipping updates</p>
            <p className="text-xs text-muted-foreground">Get notified when your order ships or is delivered</p>
          </div>
          <Switch
            checked={prefs.shippingUpdates}
            onCheckedChange={() => toggle("shippingUpdates")}
            aria-label="Shipping updates"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Promotions &amp; deals</p>
            <p className="text-xs text-muted-foreground">Flash sales, discount codes, and special offers</p>
          </div>
          <Switch
            checked={prefs.promotions}
            onCheckedChange={() => toggle("promotions")}
            aria-label="Promotions and deals"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Newsletter</p>
            <p className="text-xs text-muted-foreground">Monthly updates, product news, and tips</p>
          </div>
          <Switch
            checked={prefs.newsletter}
            onCheckedChange={() => toggle("newsletter")}
            aria-label="Newsletter"
          />
        </div>

        <Button
          type="button"
          variant={saved ? "outline" : "default"}
          size="sm"
          onClick={handleSave}
          className="mt-2"
        >
          {saved ? "Preferences saved" : "Save Preferences"}
        </Button>
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
    billingCountry: user?.billingCountry ?? "",
    billingCity: user?.billingCity ?? "",
    billingAddress: user?.billingAddress ?? "",
    billingZip: user?.billingZip ?? "",
    billingVatNumber: user?.billingVatNumber ?? "",
    billingPhone: user?.billingPhone ?? "",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [savingBirthday, setSavingBirthday] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      billingCountry: user.billingCountry ?? "",
      billingCity: user.billingCity ?? "",
      billingAddress: user.billingAddress ?? "",
      billingZip: user.billingZip ?? "",
      billingVatNumber: user.billingVatNumber ?? "",
      billingPhone: user.billingPhone ?? "",
    }));
  }, [
    user?.id,
    user?.firstName,
    user?.lastName,
    user?.billingCountry,
    user?.billingCity,
    user?.billingAddress,
    user?.billingZip,
    user?.billingVatNumber,
    user?.billingPhone,
  ]);

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
      body.billingCountry = form.billingCountry;
      body.billingCity = form.billingCity;
      body.billingAddress = form.billingAddress;
      body.billingZip = form.billingZip;
      body.billingVatNumber = form.billingVatNumber;
      body.billingPhone = form.billingPhone;
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
      <Card className="mt-0">
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
              <Label htmlFor="firstName">{t("checkout.firstName")}</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="lastName">{t("checkout.lastName")}</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4 mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium">{t("accountPage.billingAddressTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("accountPage.billingAddressHint")}</p>
            </div>
            <div>
              <Label htmlFor="profile-country">{t("checkout.country")}</Label>
              <Select
                value={form.billingCountry || undefined}
                onValueChange={(v) => update("billingCountry", v)}
              >
                <SelectTrigger id="profile-country" className="w-full">
                  <SelectValue placeholder={t("checkout.selectCountry")} />
                </SelectTrigger>
                <SelectContent className="max-h-[min(24rem,70vh)]">
                  {BILLING_COUNTRIES.map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="profile-city">{t("checkout.city")}</Label>
                <Input
                  id="profile-city"
                  value={form.billingCity}
                  onChange={(e) => update("billingCity", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="profile-zip">{t("checkout.zip")}</Label>
                <Input
                  id="profile-zip"
                  value={form.billingZip}
                  onChange={(e) => update("billingZip", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="profile-address">{t("checkout.address")}</Label>
              <Input
                id="profile-address"
                value={form.billingAddress}
                onChange={(e) => update("billingAddress", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="profile-vat">{t("checkout.vatNumber")}</Label>
              <Input
                id="profile-vat"
                value={form.billingVatNumber}
                onChange={(e) => update("billingVatNumber", e.target.value)}
                placeholder={t("accountPage.billingVatOptional")}
              />
            </div>
            <div>
              <Label htmlFor="profile-phone">{t("checkout.phone")}</Label>
              <Input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                value={form.billingPhone}
                onChange={(e) => update("billingPhone", e.target.value)}
                placeholder={t("checkout.phonePlaceholder")}
              />
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
    <EmailPreferencesSection />
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

class TabErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
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

const PlaceholderTab = ({ emptyKey, icon }: { emptyKey: string; icon: React.ReactNode }) => {
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
        <div className="flex justify-center">
          <Heart className="h-10 w-10 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">
          {count === 0 ? t("wishlist.empty") : t("accountPage.wishlistTabHint", { count })}
        </p>
        <Button asChild variant="secondary">
          <Link href="/wishlist">{t("wishlist.myWishlist")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountOrdersTab() {
  const { t } = useTranslation();
  const { token, user } = useAuthStore();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  async function openOrder(orderNumber: string) {
    setLoadingDetail(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const email = user?.email ?? "";
      const res = await fetch(`${baseUrl}/orders/${orderNumber}?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) setSelectedOrder(await res.json());
    } catch {
    } finally {
      setLoadingDetail(false);
    }
  }

  if (loading) return <Card><CardContent className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;

  if (selectedOrder) return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)} className="mb-4">
        &larr; {t("accountPage.backToOrders")}
      </Button>
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
            <button
              key={o.orderNumber}
              onClick={() => openOrder(o.orderNumber)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition text-left"
            >
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
            </button>
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
