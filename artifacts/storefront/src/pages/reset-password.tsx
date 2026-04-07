import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const params = useParams<{ token: string }>();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: t("resetPassword.passwordsMismatch"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("resetPassword.failed"));

      setDone(true);
    } catch (err) {
      toast({
        title: t("resetPassword.failed"),
        description: err instanceof Error ? err.message : t("checkout.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("resetPassword.title") }]} />

      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Lock className="h-6 w-6" /> {t("resetPassword.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="font-medium">{t("resetPassword.success")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("resetPassword.successDesc")}
                </p>
                <Button onClick={() => setLocation("/login")} className="mt-2">
                  {t("resetPassword.goToSignIn")}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">{t("resetPassword.newPassword")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("resetPassword.minChars")}
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">{t("resetPassword.confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t("resetPassword.resetButton")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
