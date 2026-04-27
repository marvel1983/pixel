import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { ProfileStoreCreditCard } from "./profile-store-credit";
import { ProfileLoyaltyCard } from "./profile-loyalty-card";
import { EmailPreferencesSection } from "./email-preferences-section";
import { ProfileBillingAddress } from "./profile-billing-address";

export function ProfileTab() {
  const { t } = useTranslation();
  const { user, token, setAuth } = useAuthStore();
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: user?.firstName ?? "", lastName: user?.lastName ?? "",
    billingCountry: user?.billingCountry ?? "", billingCity: user?.billingCity ?? "",
    billingAddress: user?.billingAddress ?? "", billingZip: user?.billingZip ?? "",
    billingVatNumber: user?.billingVatNumber ?? "", billingPhone: user?.billingPhone ?? "",
    currentPassword: "", newPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [savingBirthday, setSavingBirthday] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      firstName: user.firstName ?? "", lastName: user.lastName ?? "",
      billingCountry: user.billingCountry ?? "", billingCity: user.billingCity ?? "",
      billingAddress: user.billingAddress ?? "", billingZip: user.billingZip ?? "",
      billingVatNumber: user.billingVatNumber ?? "", billingPhone: user.billingPhone ?? "",
    }));
  }, [user?.id, user?.firstName, user?.lastName, user?.billingCountry, user?.billingCity, user?.billingAddress, user?.billingZip, user?.billingVatNumber, user?.billingPhone]);

  useEffect(() => {
    if (!token) return;
    const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
    fetch(`${baseUrl}/loyalty/birthday`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.dateOfBirth) setBirthday(d.dateOfBirth.slice(0, 10)); })
      .catch(() => {});
  }, [token]);

  async function handleSaveBirthday() {
    if (!birthday) return;
    setSavingBirthday(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/loyalty/birthday`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify({ dateOfBirth: birthday }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Birthday saved!" });
    } catch { toast({ title: "Failed to save birthday", variant: "destructive" }); }
    finally { setSavingBirthday(false); }
  }

  function update(field: string, value: string) { setForm((prev) => ({ ...prev, [field]: value })); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const body: Record<string, string> = {};
      if (form.firstName) body.firstName = form.firstName;
      if (form.lastName) body.lastName = form.lastName;
      body.billingCountry = form.billingCountry; body.billingCity = form.billingCity;
      body.billingAddress = form.billingAddress; body.billingZip = form.billingZip;
      body.billingVatNumber = form.billingVatNumber; body.billingPhone = form.billingPhone;
      if (form.newPassword) { body.currentPassword = form.currentPassword; body.newPassword = form.newPassword; }
      const res = await fetch(`${baseUrl}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("accountPage.updateFailed"));
      setAuth(data.user, token!);
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
      toast({ title: t("accountPage.profileUpdated") });
    } catch (err) {
      toast({ title: t("accountPage.updateFailed"), description: err instanceof Error ? err.message : t("checkout.tryAgain"), variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-0">
      <ProfileStoreCreditCard />
      <ProfileLoyaltyCard />
      <Card className="mt-0">
        <CardHeader><CardTitle>{t("accountPage.profileInfo")}</CardTitle></CardHeader>
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
            <ProfileBillingAddress
              country={form.billingCountry} city={form.billingCity} zip={form.billingZip}
              address={form.billingAddress} vatNumber={form.billingVatNumber} phone={form.billingPhone}
              update={update}
            />
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">{t("accountPage.changePassword")}</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="currentPassword">{t("accountPage.currentPassword")}</Label>
                  <Input id="currentPassword" type="password" value={form.currentPassword} onChange={(e) => update("currentPassword", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="newPassword">{t("accountPage.newPassword")}</Label>
                  <Input id="newPassword" type="password" value={form.newPassword} onChange={(e) => update("newPassword", e.target.value)} minLength={8} />
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
              <p className="text-xs text-muted-foreground mb-2">Set your birthday to receive bonus points on your special day!</p>
              <div className="flex gap-2">
                <Input id="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="flex-1" />
                <Button type="button" variant="outline" onClick={handleSaveBirthday} disabled={savingBirthday || !birthday}>
                  {savingBirthday ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Save
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
