import { AlertTriangle } from "lucide-react";
import { useStockUrgency } from "@/hooks/use-social-proof";

interface StockUrgencyBadgeProps {
  stockCount: number;
  compact?: boolean;
}

export function StockUrgencyBadge({ stockCount, compact }: StockUrgencyBadgeProps) {
  const { show, label, variant } = useStockUrgency(stockCount);

  if (!show) return null;

  const colors = variant === "critical"
    ? "text-red-700 bg-red-50 border-red-200"
    : "text-amber-700 bg-amber-50 border-amber-200";

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5 border ${colors}`}>
        <AlertTriangle className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium rounded-md px-2.5 py-1.5 border ${colors}`}>
      <AlertTriangle className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}
