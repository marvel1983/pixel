import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { apiFetch } = await import("@/lib/api-client");
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.resetToken) {
          setLocation(`/reset-password/${data.resetToken}`);
          return;
        }
        setSent(true);
      }
    } catch {
      toast({ title: t("common.somethingWentWrong"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("forgotPassword.title") }]} />

      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <KeyRound className="h-6 w-6" /> {t("forgotPassword.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="font-medium">{t("forgotPassword.checkEmail")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("forgotPassword.checkEmailDesc", { email })}
                </p>
                <Link href="/login" className="text-sm text-primary hover:underline">
                  {t("forgotPassword.backToSignIn")}
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("forgotPassword.subtitle")}
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">{t("auth.email")}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.emailPlaceholder")}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t("forgotPassword.sendResetLink")}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-4">
                  <Link href="/login" className="text-primary hover:underline">
                    {t("forgotPassword.backToSignIn")}
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
