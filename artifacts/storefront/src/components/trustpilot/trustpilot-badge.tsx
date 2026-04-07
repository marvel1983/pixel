import { useTrustpilot } from "@/hooks/use-trustpilot";
import { TrustpilotStars, TrustpilotLogo } from "./trustpilot-stars";

interface TrustpilotBadgeProps {
  variant?: "compact" | "full";
}

export function TrustpilotBadge({ variant = "compact" }: TrustpilotBadgeProps) {
  const { enabled, cachedRating, cachedCount, trustpilotUrl, loaded } = useTrustpilot();

  if (!loaded || !enabled) return null;

  if (variant === "compact") {
    const inner = (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
        <TrustpilotStars rating={cachedRating} size="sm" />
        <span className="text-xs text-gray-600">
          <span className="font-semibold text-gray-900">{cachedRating.toFixed(1)}</span>
          {" · Trustpilot"}
        </span>
      </div>
    );
    if (trustpilotUrl) {
      return <a href={trustpilotUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">{inner}</a>;
    }
    return inner;
  }

  const fullInner = (
    <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
      <div className="flex flex-col gap-1">
        <TrustpilotLogo className="text-sm" />
        <TrustpilotStars rating={cachedRating} size="md" />
      </div>
      <div className="text-sm">
        <div className="font-semibold">{cachedRating.toFixed(1)} / 5</div>
        <div className="text-muted-foreground text-xs">{cachedCount.toLocaleString()} reviews</div>
      </div>
    </div>
  );

  if (trustpilotUrl) {
    return <a href={trustpilotUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-90 transition-opacity">{fullInner}</a>;
  }
  return fullInner;
}
