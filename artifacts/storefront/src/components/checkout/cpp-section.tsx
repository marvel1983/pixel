import { Shield, ShieldCheck } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency-store";

interface CppSectionProps {
  selected: boolean;
  onToggle: (v: boolean) => void;
  subtotal: number;
}

const CPP_RATE = 0.05;

export function getCppAmount(subtotal: number) {
  return Math.round(subtotal * CPP_RATE * 100) / 100;
}

export function CppSection({ selected, onToggle, subtotal }: CppSectionProps) {
  const { format } = useCurrencyStore();
  const cppPrice = getCppAmount(subtotal);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">Customer Protection Program</h2>
      <p className="text-sm text-muted-foreground">
        Protect your purchase with our CPP. Get full refund or replacement if
        your key doesn't activate within 30 days.
      </p>

      <div className="space-y-2">
        <label
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selected ? "border-primary bg-primary/5" : "hover:border-border"
          }`}
        >
          <input
            type="radio"
            name="cpp"
            checked={selected}
            onChange={() => onToggle(true)}
            className="accent-primary"
          />
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium">Yes, protect my order</span>
            <p className="text-xs text-muted-foreground">
              Full coverage for 30 days
            </p>
          </div>
          <span className="text-sm font-semibold">{format(cppPrice)}</span>
        </label>

        <label
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            !selected ? "border-primary bg-primary/5" : "hover:border-border"
          }`}
        >
          <input
            type="radio"
            name="cpp"
            checked={!selected}
            onChange={() => onToggle(false)}
            className="accent-primary"
          />
          <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <span className="text-sm font-medium">No thanks</span>
            <p className="text-xs text-muted-foreground">
              Standard purchase without protection
            </p>
          </div>
          <span className="text-sm font-semibold">Free</span>
        </label>
      </div>
    </div>
  );
}
