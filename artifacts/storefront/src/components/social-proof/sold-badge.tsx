import { TrendingUp } from "lucide-react";
import { useSoldCount } from "@/hooks/use-social-proof";

interface SoldBadgeProps {
  productId: number;
  compact?: boolean;
}

export function SoldBadge({ productId, compact }: SoldBadgeProps) {
  const { sold, minThreshold, enabled } = useSoldCount(productId);

  if (!enabled || sold < minThreshold) return null;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 dark:text-green-300 dark:bg-green-900/40 dark:border-green-800">
        <TrendingUp className="h-2.5 w-2.5" />
        {sold} sold today
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-green-700">
      <TrendingUp className="h-4 w-4" />
      <span>{sold} sold in the last 24 hours</span>
    </div>
  );
}
