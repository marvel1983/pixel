import { ShoppingCart, CreditCard, CheckCircle } from "lucide-react";

interface CartProgressProps {
  step: 1 | 2 | 3;
}

const STEPS = [
  { label: "Shopping Cart", icon: ShoppingCart },
  { label: "Checkout", icon: CreditCard },
  { label: "Order Complete", icon: CheckCircle },
];

export function CartProgress({ step }: CartProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === step;
        const isComplete = stepNum < step;
        const Icon = s.icon;

        return (
          <div key={s.label} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-16 sm:w-24 h-0.5 ${
                  isComplete || isActive ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isActive
                    ? "bg-primary text-white"
                    : isComplete
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive ? "text-primary" : isComplete ? "text-foreground" : "text-muted-foreground"
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
