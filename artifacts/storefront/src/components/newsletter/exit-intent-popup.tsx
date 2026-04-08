import { useState, useEffect, useCallback } from "react";
import { X, Mail, Loader2, Gift } from "lucide-react";
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={dismiss}>
      <div
        className="relative bg-card rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={dismiss} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 z-10">
          <X className="h-5 w-5 text-gray-400" />
        </button>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-center text-white">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-90" />
          <h2 className="text-xl font-bold mb-1">{settings.exitIntentHeadline}</h2>
          <p className="text-blue-100 text-sm">{settings.exitIntentBody}</p>
        </div>

        <div className="px-6 py-6">
          {result ? (
            <div className="text-center space-y-3">
              <p className="text-green-600 font-medium">{result.message}</p>
              {result.discountCode && (
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Your discount code:</p>
                  <p className="text-2xl font-bold text-green-700 tracking-widest">{result.discountCode}</p>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={dismiss}>Close</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Subscribing...</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" />Get My {settings.exitIntentDiscount}% Discount</>
                )}
              </Button>
              <p className="text-xs text-center text-gray-400">
                No spam. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
