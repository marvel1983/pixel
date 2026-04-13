import { CreditCard } from "lucide-react";

const METHOD_COLORS: Record<string, string> = {
  "Visa":        "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
  "Mastercard":  "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300",
  "PayPal":      "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-300",
  "Apple Pay":   "bg-zinc-50 border-zinc-300 text-zinc-700 dark:bg-zinc-800/60 dark:border-zinc-600 dark:text-zinc-300",
  "Google Pay":  "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300",
};

export function PaymentIcons() {
  const methods = ["Visa", "Mastercard", "PayPal", "Apple Pay", "Google Pay"];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <CreditCard className="h-4 w-4 text-muted-foreground" />
      {methods.map((m) => (
        <span
          key={m}
          className={`text-[10px] px-2 py-1 rounded-md border font-semibold ${METHOD_COLORS[m]}`}
        >
          {m}
        </span>
      ))}
    </div>
  );
}
