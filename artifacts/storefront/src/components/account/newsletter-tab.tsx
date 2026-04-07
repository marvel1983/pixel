import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Mail, Check, X, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export function NewsletterTab() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    fetch(`${API}/newsletter/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, source: "account" }),
    })
      .then((r) => r.json())
      .then((d) => {
        setSubscribed(d.message?.includes("already subscribed") || d.message?.includes("Subscribed") || false);
      })
      .catch(() => setSubscribed(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.email) { setLoading(false); return; }
    fetch(`${API}/newsletter/status?email=${encodeURIComponent(user.email)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) setSubscribed(d.subscribed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.email]);

  async function handleSubscribe() {
    if (!user?.email) return;
    setToggling(true);
    try {
      const res = await fetch(`${API}/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, source: "account" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Subscribed", description: data.message });
      setSubscribed(true);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Newsletter Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking subscription status...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {subscribed ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">You are subscribed to our newsletter</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <X className="h-5 w-5" />
                  <span>You are not subscribed to our newsletter</span>
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {subscribed
                ? "You'll receive exclusive deals, product updates, and special discounts. You can unsubscribe anytime via the link in our emails."
                : "Subscribe to get exclusive deals, new product alerts, and special discount codes delivered to your inbox."}
            </p>

            {!subscribed && (
              <Button onClick={handleSubscribe} disabled={toggling} size="sm">
                {toggling ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Subscribing...</> : "Subscribe Now"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
