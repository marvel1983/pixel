import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCurrencyStore } from "@/stores/currency-store";
import { Loader2 } from "lucide-react";

const AMOUNTS = [10, 25, 50, 100];

interface Props {
  onSubmit: (amount: number) => Promise<void>;
  onCancel: () => void;
  processing: boolean;
}

export function WalletTopUpForm({ onSubmit, onCancel, processing }: Props) {
  const format = useCurrencyStore((s) => s.format);
  const [amount, setAmount] = useState("");

  const displayAmt = parseFloat(amount) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt < 5 || amt > 500) return;
    await onSubmit(amt);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-sm">Amount</Label>
        <Input
          type="number" min="5" max="500" step="0.01"
          placeholder="Enter amount (min 5)"
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
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={processing || displayAmt < 5}>
          {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {processing ? "Redirecting to Stripe..." : `Add ${displayAmt > 0 ? format(displayAmt) : "Funds"}`}
        </Button>
      </div>
    </form>
  );
}
