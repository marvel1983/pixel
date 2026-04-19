import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

/* ─── Custom gift card icon ─────────────────────────────── */
function GiftCardIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden="true">
      {/* card body */}
      <rect x="4" y="12" width="40" height="26" rx="5" fill="#10b981" opacity="0.12" />
      <rect x="4" y="12" width="40" height="26" rx="5" stroke="#10b981" strokeWidth="2.2" />
      {/* ribbon horizontal */}
      <line x1="4" y1="24" x2="44" y2="24" stroke="#10b981" strokeWidth="2" opacity="0.5" />
      {/* ribbon vertical */}
      <line x1="24" y1="12" x2="24" y2="38" stroke="#10b981" strokeWidth="2" opacity="0.5" />
      {/* bow — left loop */}
      <path d="M24 12 Q17 6 14 10 Q12 14 24 16" fill="#10b981" opacity="0.35" />
      {/* bow — right loop */}
      <path d="M24 12 Q31 6 34 10 Q36 14 24 16" fill="#10b981" opacity="0.35" />
      {/* bow center knot */}
      <circle cx="24" cy="14" r="2.5" fill="#10b981" opacity="0.7" />
      {/* stars / sparkles on card */}
      <circle cx="13" cy="31" r="1.5" fill="#10b981" opacity="0.4" />
      <circle cx="36" cy="31" r="1.5" fill="#10b981" opacity="0.4" />
      <circle cx="13" cy="18" r="1" fill="#10b981" opacity="0.3" />
    </svg>
  );
}

export function GiftCardInput({ appliedCards, onApply, onRemove, remainingTotal }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalApplied = appliedCards.reduce((s, c) => s + c.applied, 0);
  const hasApplied = appliedCards.length > 0;

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (appliedCards.some((c) => c.code === trimmed)) {
      setError(t("checkout.alreadyApplied")); return;
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
      if (!res.ok) { setError(data.error || t("checkout.invalidGiftCard")); return; }
      const balance = parseFloat(data.balance);
      const toApply = Math.min(balance, remainingTotal);
      onApply({ code: data.code, balance, applied: toApply });
      setCode("");
    } catch {
      setError(t("checkout.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden border h-full"
      style={{
        background: hasApplied
          ? "linear-gradient(135deg, #001a0e 0%, #002b16 60%, #001a0e 100%)"
          : "linear-gradient(135deg, #0f1629 0%, #1a243d 60%, #0f1629 100%)",
        borderColor: hasApplied ? "#10b98155" : "#ffffff15",
      }}
    >
      {/* glow when applied */}
      {hasApplied && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 20% 50%, #10b98112, transparent)" }}
        />
      )}

      <div className="relative p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <GiftCardIcon />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">
                {t("checkout.haveGiftCard")}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5">Enter your code below</p>
            </div>
          </div>
          {totalApplied > 0 && (
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-green-400">−€{totalApplied.toFixed(2)}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">applied</p>
            </div>
          )}
        </div>

        {/* Applied cards */}
        {appliedCards.map((c) => (
          <div
            key={c.code}
            className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm"
            style={{ background: "#10b98118", border: "1px solid #10b98130" }}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-green-400 font-medium">{c.code}</span>
              <span className="text-green-400/70 text-xs">−€{c.applied.toFixed(2)}</span>
              {c.balance > c.applied && (
                <span className="text-[10px] text-white/30">
                  ({t("checkout.remaining", { amount: `€${(c.balance - c.applied).toFixed(2)}` })} left)
                </span>
              )}
            </div>
            <button
              onClick={() => onRemove(c.code)}
              className="text-white/30 hover:text-red-400 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {/* Input row */}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border px-3 py-1.5 text-sm font-mono uppercase tracking-widest bg-white/8 border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/50 focus:bg-white/12 transition-colors"
            placeholder="GC-XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleApply}
            disabled={loading || !code.trim()}
            className="h-9 border-green-500/40 text-green-400 hover:bg-green-500/10 hover:text-green-300 bg-transparent text-xs px-4"
          >
            {loading ? "…" : t("checkout.apply")}
          </Button>
        </div>

        {error && (
          <p className="text-[11px] text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
