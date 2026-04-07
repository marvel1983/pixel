import { Eye } from "lucide-react";
import { useViewerCount } from "@/hooks/use-social-proof";

interface ViewerCountProps {
  productId: number;
}

export function ViewerCount({ productId }: ViewerCountProps) {
  const { viewers, minThreshold, enabled } = useViewerCount(productId);

  if (!enabled || viewers < minThreshold) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm text-orange-600">
      <Eye className="h-4 w-4" />
      <span>{viewers} people are viewing this right now</span>
    </div>
  );
}
