import { ShoppingCart, CreditCard, CheckCircle } from "lucide-react";

interface CartProgressProps {
  step: 1 | 2 | 3;
}

const STEPS = [
  { label: "Cart", icon: ShoppingCart },
  { label: "Checkout", icon: CreditCard },
  { label: "Confirmation", icon: CheckCircle },
];

export function CartProgress({ step }: CartProgressProps) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((s, i) => {
        const num = i + 1;
        const isActive = num === step;
        const isDone = num < step;
        const Icon = s.icon;

        return (
          <div key={s.label} className="flex items-center">
            {i > 0 && (
              <div className="relative mx-2 h-px w-16 sm:w-28 bg-border overflow-hidden">
                <div
                  className="absolute inset-0 bg-primary transition-transform duration-500 origin-left"
                  style={{ transform: isDone ? "scaleX(1)" : "scaleX(0)" }}
                />
              </div>
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`
                  flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors duration-300
                  ${isActive ? "border-primary bg-primary text-white shadow-md shadow-primary/30" : ""}
                  ${isDone ? "border-primary bg-primary/10 text-primary" : ""}
                  ${!isActive && !isDone ? "border-border bg-background text-muted-foreground" : ""}
                `}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={`text-[11px] font-semibold whitespace-nowrap tracking-wide ${
                  isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
