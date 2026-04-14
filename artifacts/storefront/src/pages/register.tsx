import { useState, useEffect, useLayoutEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { UserPlus, Eye, EyeOff, Loader2 } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { COUNTRY_OPTIONS } from "@/lib/country-options";

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    billingCountry: "",
    billingCity: "",
    billingZip: "",
    billingAddress: "",
    billingVatNumber: "",
    billingPhone: "",
  });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeoMeta({ title: t("seo.registerTitle"), description: t("seo.registerDescription") });
    return () => { clearSeoMeta(); };
  }, [t]);

  useLayoutEffect(() => {
    if (token) setLocation("/account", { replace: true });
  }, [token, setLocation]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast({ title: t("auth.passwordsMismatch"), variant: "destructive" });
      return;
    }
    if (!agreeTerms) {
      toast({ title: t("auth.agreeTerms"), variant: "destructive" });
      return;
    }
    if (!form.billingCountry) {
      toast({ title: t("checkout.selectCountry"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { apiFetch } = await import("@/lib/api-client");
      const res = await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          agreeTerms: true,
          locale: i18n.language,
          billingCountry: form.billingCountry,
          billingCity: form.billingCity,
          billingZip: form.billingZip,
          billingAddress: form.billingAddress,
          billingPhone: form.billingPhone,
          ...(form.billingVatNumber.trim()
            ? { billingVatNumber: form.billingVatNumber.trim() }
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");

      setAuth(data.user, data.token);
      toast({ title: t("auth.accountCreated") });
      setLocation("/");
    } catch (err) {
      toast({
        title: t("auth.registrationFailed"),
        description: err instanceof Error ? err.message : t("checkout.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("auth.createAccount") }]} />

      <div className="max-w-lg mx-auto mt-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <UserPlus className="h-6 w-6" /> {t("auth.createAccount")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">{t("checkout.firstName")}</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">{t("checkout.lastName")}</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder={t("auth.emailPlaceholder")}
                  required
                />
              </div>

              <div className="border-t pt-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold">{t("checkout.billingDetails")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("auth.registerAddressHint")}</p>
                </div>
                <div>
                  <Label htmlFor="reg-country">{t("checkout.country")}</Label>
                  <Select
                    value={form.billingCountry || undefined}
                    onValueChange={(v) => update("billingCountry", v)}
                  >
                    <SelectTrigger id="reg-country" className="w-full">
                      <SelectValue placeholder={t("checkout.selectCountry")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(24rem,70vh)]">
                      {COUNTRY_OPTIONS.map(([code, name]) => (
                        <SelectItem key={code} value={code}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="reg-city">{t("checkout.city")}</Label>
                    <Input
                      id="reg-city"
                      value={form.billingCity}
                      onChange={(e) => update("billingCity", e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="reg-zip">{t("checkout.zip")}</Label>
                    <Input
                      id="reg-zip"
                      value={form.billingZip}
                      onChange={(e) => update("billingZip", e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-address">{t("checkout.address")}</Label>
                  <Input
                    id="reg-address"
                    value={form.billingAddress}
                    onChange={(e) => update("billingAddress", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="reg-vat">{t("checkout.vatNumber")}</Label>
                  <Input
                    id="reg-vat"
                    value={form.billingVatNumber}
                    onChange={(e) => update("billingVatNumber", e.target.value)}
                    placeholder={t("accountPage.billingVatOptional")}
                  />
                </div>
                <div>
                  <Label htmlFor="reg-phone">{t("checkout.phone")}</Label>
                  <Input
                    id="reg-phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.billingPhone}
                    onChange={(e) => update("billingPhone", e.target.value)}
                    placeholder={t("checkout.phonePlaceholder")}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder={t("resetPassword.minChars")}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw(!showPw)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="terms"
                  checked={agreeTerms}
                  onCheckedChange={(v) => setAgreeTerms(v === true)}
                />
                <Label htmlFor="terms" className="text-sm font-normal">
                  {t("auth.agreeToTerms")}
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("auth.createAccount")}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("common.or")}</span></div>
            </div>

            <GoogleButton label={t("auth.signUpWithGoogle")} />

            <p className="text-center text-sm text-muted-foreground mt-4">
              {t("auth.haveAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                {t("auth.signInHere")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
