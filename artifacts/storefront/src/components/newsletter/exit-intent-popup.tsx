import { useState, useEffect, useCallback } from "react";
import { X, Mail, Loader2, Sparkles, ArrowRight, ShieldCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Settings {
  enabled: boolean;
  exitIntentEnabled: boolean;
  exitIntentHeadline: string;
  exitIntentBody: string;
  exitIntentDiscount: number;
}

export function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; discountCode?: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("exit_intent_shown")) return;
    fetch(`${API}/newsletter/settings/public`)
      .then((r) => r.json())
      .then((data: Settings) => {
        if (data.enabled && data.exitIntentEnabled) setSettings(data);
      })
      .catch(() => {});
  }, []);

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    if (e.clientY <= 0 && settings && !dismissed && !sessionStorage.getItem("exit_intent_shown")) {
      setShow(true);
      sessionStorage.setItem("exit_intent_shown", "1");
    }
  }, [settings, dismissed]);

  useEffect(() => {
    if (!settings) return;
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [settings, handleMouseLeave]);

  function dismiss() {
    setShow(false);
    setDismissed(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/newsletter/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "exit_intent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ message: data.message, discountCode: data.discountCode });
    } catch (err) {
      setResult({ message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setLoading(false);
    }
  }

  if (!show || !settings) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={dismiss}
    >
      <div
        className="relative bg-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-primary via-[hsl(208,74%,40%)] to-[hsl(208,74%,28%)] px-6 pt-6 pb-7 text-white overflow-hidden">
          <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-[hsl(36,100%,55%)]/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-white/15 blur-2xl pointer-events-none" />

          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[11px] font-semibold tracking-wider uppercase">
              <Sparkles className="h-3 w-3 text-[hsl(36,100%,65%)]" />
              Limited time offer
            </div>
            <div className="flex items-baseline gap-0.5 mt-3">
              <span className="text-6xl font-black leading-none tabular-nums">{settings.exitIntentDiscount}</span>
              <span className="text-4xl font-black text-[hsl(36,100%,60%)]!">%</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] mt-1 text-white/80">
              Off Your First Order
            </span>
          </div>
        </div>

        <div className="px-6 pt-5 pb-5">
          {result ? (
            <div className="text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-foreground font-semibold">{result.message}</p>
              {result.discountCode && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-green-700 dark:text-green-400 font-semibold mb-1">
                    Your code
                  </p>
                  <p className="text-2xl font-black text-green-700 dark:text-green-400 tracking-widest">
                    {result.discountCode}
                  </p>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={dismiss} className="w-full">
                Continue shopping
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-center text-foreground leading-snug">
                {settings.exitIntentHeadline}
              </h2>
              <p className="text-sm text-muted-foreground text-center mt-1.5 mb-4 leading-relaxed">
                {settings.exitIntentBody}
              </p>

              <form onSubmit={handleSubmit} className="space-y-2.5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-10 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 font-bold gap-2 bg-gradient-to-r from-primary to-[hsl(208,74%,32%)] hover:from-[hsl(208,74%,40%)] hover:to-[hsl(208,74%,26%)] shadow-md text-white border-0"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Subscribing...</>
                  ) : (
                    <>Claim My {settings.exitIntentDiscount}% Discount<ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                <span>Secure</span>
                <span className="opacity-50">•</span>
                <span>No spam</span>
                <span className="opacity-50">•</span>
                <span>Unsubscribe anytime</span>
              </div>

              <button
                type="button"
                onClick={dismiss}
                className="block mx-auto mt-2.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                No thanks, I'll pay full price
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
