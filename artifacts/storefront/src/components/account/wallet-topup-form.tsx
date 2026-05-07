import { useState } from "react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrencyStore } from "@/stores/currency-store";
import { Loader2, Lock } from "lucide-react";
import { uuidV4 } from "@/lib/uuid";

const API = import.meta.env.VITE_API_URL ?? "/api";

const AMOUNTS = [10, 25, 50, 100];

function getCardStyle() {
  const dark = document.documentElement.classList.contains("dark");
  return {
    style: {
      base: {
        fontSize: "14px",
        fontFamily: "inherit",
        color: dark ? "#f8fafc" : "#0f172a",
        "::placeholder": { color: dark ? "#94a3b8" : "#64748b" },
      },
      invalid: { color: "#ef4444" },
    },
  };
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

export function WalletTopUpForm({ onSuccess, onCancel }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const { token } = useAuthStore();
  const format = useCurrencyStore((s) => s.format);
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [cardReady, setCardReady] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const amt = parseFloat(amount);
    if (!amt || amt < 5 || amt > 500) {
      toast({ title: "Amount must be between $5 and $500", variant: "destructive" }); return;
    }

    const card = elements.getElement(CardElement);
    if (!card) return;

    setProcessing(true);
    try {
      // Create PaymentIntent on our server
      const intentRes = await fetch(`${API}/wallet/topup/intent`, {
        method: "POST", headers, credentials: "include",
        body: JSON.stringify({ amountUsd: amt }),
      });
      const intentData = await intentRes.json();
      if (!intentRes.ok) throw new Error(intentData.error ?? "Failed to initiate payment");

      // Confirm card charge via Stripe.js — card data stays in Stripe's iframe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        intentData.clientSecret,
        { payment_method: { card } },
      );
      if (stripeError) throw new Error(stripeError.message ?? "Card declined");
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment not completed");

      // Tell our server to credit the wallet after verifying with Stripe
      const confirmRes = await fetch(`${API}/wallet/topup/confirm`, {
        method: "POST",
        headers: { ...headers, "X-Idempotency-Key": uuidV4() },
        credentials: "include",
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error ?? "Failed to apply top-up");

      toast({ title: `${format(amt)} added to your wallet` });
      onSuccess();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Top-up failed", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  }

  const displayAmt = parseFloat(amount) || 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm">Amount (USD)</Label>
        <Input
          type="number" min="5" max="500" step="0.01"
          placeholder="Enter amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          {AMOUNTS.map((v) => (
            <Button key={v} type="button" variant="outline" size="sm"
              className={amount === String(v) ? "border-primary" : ""}
              onClick={() => setAmount(String(v))}>
              {format(v)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm">Card Details</Label>
        <div className="rounded-md border border-input bg-background px-3 py-3 focus-within:ring-1 focus-within:ring-ring">
          <CardElement options={getCardStyle()} onReady={() => setCardReady(true)} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <Lock className="h-3 w-3" /> Secured by Stripe — card details never reach our servers
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={!stripe || !cardReady || processing}>
          {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {processing ? "Processing..." : `Add ${displayAmt > 0 ? format(displayAmt) : "Funds"}`}
        </Button>
      </div>
    </form>
  );
}
