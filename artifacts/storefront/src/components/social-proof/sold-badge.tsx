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
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
        <TrendingUp className="h-2.5 w-2.5" />
        {sold} sold today
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-green-700">
      <TrendingUp className="h-4 w-4" />
      <span>{sold} sold in the last 24 hours</span>
    </div>
  );
}
