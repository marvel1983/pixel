import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { GoogleButton } from "@/components/auth/google-button";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

export default function LoginPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeoMeta({ title: t("seo.loginTitle"), description: t("seo.loginDescription") });
    return () => { clearSeoMeta(); };
  }, [t]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      toast({ title: "Sign in failed", description: error, variant: "destructive" });
      window.history.replaceState({}, "", "/login");
    }
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");

      setAuth(data.user, data.token);
      toast({ title: t("auth.welcomeBack") });
      setLocation("/");
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("auth.signIn") }]} />

      <div className="max-w-md mx-auto mt-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <LogIn className="h-6 w-6" /> {t("auth.signIn")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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

              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("auth.signIn")}
              </Button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t("common.or")}</span></div>
            </div>

            <GoogleButton />

            <p className="text-center text-sm text-muted-foreground mt-4">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                {t("auth.createOne")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
