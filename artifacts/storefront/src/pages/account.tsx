import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { User, ShoppingBag, Heart, Star, Gift, Link2, Mail, Loader2 } from "lucide-react";
import { GiftCardsTab } from "@/components/account/gift-cards-tab";
import { AffiliateTab } from "@/components/account/affiliate-tab";
import { NewsletterTab } from "@/components/account/newsletter-tab";

function ProfileTab() {
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
      if (!res.ok) throw new Error(data.error ?? "Update failed");

      setAuth(data.user, token!);
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium mb-3">Change Password</p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => update("currentPassword", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
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
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlaceholderTab({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <div className="flex justify-center mb-3">{icon}</div>
        <p>Your {title.toLowerCase()} will appear here.</p>
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "My Account" }]} />

      <h1 className="text-2xl font-bold mt-4 mb-6">
        Welcome, {user.firstName ?? user.email}
      </h1>

      <Tabs defaultValue="profile">
        <TabsList className="mb-4">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ShoppingBag className="h-4 w-4" /> Orders
          </TabsTrigger>
          <TabsTrigger value="wishlist" className="gap-1.5">
            <Heart className="h-4 w-4" /> Wishlist
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5">
            <Star className="h-4 w-4" /> Reviews
          </TabsTrigger>
          <TabsTrigger value="gift-cards" className="gap-1.5">
            <Gift className="h-4 w-4" /> Gift Cards
          </TabsTrigger>
          <TabsTrigger value="affiliate" className="gap-1.5">
            <Link2 className="h-4 w-4" /> Affiliate
          </TabsTrigger>
          <TabsTrigger value="newsletter" className="gap-1.5">
            <Mail className="h-4 w-4" /> Newsletter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="orders">
          <AccountOrdersTab />
        </TabsContent>
        <TabsContent value="wishlist">
          <PlaceholderTab title="Wishlist" icon={<Heart className="h-8 w-8" />} />
        </TabsContent>
        <TabsContent value="reviews">
          <PlaceholderTab title="Reviews" icon={<Star className="h-8 w-8" />} />
        </TabsContent>
        <TabsContent value="gift-cards">
          <GiftCardsTab />
        </TabsContent>
        <TabsContent value="affiliate">
          <AffiliateTab />
        </TabsContent>
        <TabsContent value="newsletter">
          <NewsletterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountOrdersTab() {
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
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShoppingBag className="h-8 w-8 mx-auto mb-3" />
          <p>No orders yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {orders.map((o) => (
            <a
              key={o.orderNumber}
              href={`/order-lookup`}
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition"
            >
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {o.firstProduct} {o.itemCount > 1 ? `+${o.itemCount - 1} more` : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">${o.totalUsd}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString()}
                </p>
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
