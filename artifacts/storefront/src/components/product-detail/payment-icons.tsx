import { CreditCard } from "lucide-react";

export function PaymentIcons() {
  const methods = ["Visa", "Mastercard", "PayPal", "Apple Pay", "Google Pay"];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CreditCard className="h-4 w-4 text-muted-foreground" />
      {methods.map((m) => (
        <span
          key={m}
          className="text-[10px] px-2 py-0.5 rounded border bg-muted/50 text-muted-foreground font-medium"
        >
          {m}
        </span>
      ))}
    </div>
  );
}
