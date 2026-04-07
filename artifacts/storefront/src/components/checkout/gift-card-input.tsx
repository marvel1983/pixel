import { useState } from "react";
import { Gift, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = import.meta.env.VITE_API_URL ?? "/api";

export interface AppliedGiftCard {
  code: string;
  balance: number;
  applied: number;
}

interface Props {
  appliedCards: AppliedGiftCard[];
  onApply: (card: AppliedGiftCard) => void;
  onRemove: (code: string) => void;
  remainingTotal: number;
}

export function GiftCardInput({ appliedCards, onApply, onRemove, remainingTotal }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalApplied = appliedCards.reduce((s, c) => s + c.applied, 0);

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (appliedCards.some((c) => c.code === trimmed)) {
      setError("This gift card is already applied"); return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/gift-cards/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid gift card"); return; }
      const balance = parseFloat(data.balance);
      const toApply = Math.min(balance, remainingTotal);
      onApply({ code: data.code, balance, applied: toApply });
      setCode("");
    } catch { setError("Network error"); } finally { setLoading(false); }
  };

  return (
    <div className="rounded-lg border bg-white">
      <button className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium" onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-blue-600" />
          Have a gift card?
          {totalApplied > 0 && <Badge variant="secondary" className="bg-green-50 text-green-700">-${totalApplied.toFixed(2)}</Badge>}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {appliedCards.map((c) => (
            <div key={c.code} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
              <div>
                <span className="font-mono font-medium">{c.code}</span>
                <span className="text-muted-foreground ml-2">-${c.applied.toFixed(2)}</span>
                {c.balance > c.applied && <span className="text-xs text-muted-foreground ml-1">(${(c.balance - c.applied).toFixed(2)} remaining)</span>}
              </div>
              <button onClick={() => onRemove(c.code)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex gap-2">
            <input className="flex-1 rounded-md border px-3 py-2 text-sm font-mono uppercase" placeholder="GC-XXXX-XXXX-XXXX-XXXX"
              value={code} onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApply()} />
            <Button variant="outline" size="sm" onClick={handleApply} disabled={loading || !code.trim()}>
              {loading ? "..." : "Apply"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
