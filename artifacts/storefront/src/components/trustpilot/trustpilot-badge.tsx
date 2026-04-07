import { useRef } from "react";
import { useTrustpilot, useTrustpilotWidget } from "@/hooks/use-trustpilot";
import { TrustpilotStars, TrustpilotLogo } from "./trustpilot-stars";

interface TrustpilotBadgeProps {
  variant?: "compact" | "full";
}

export function TrustpilotBadge({ variant = "compact" }: TrustpilotBadgeProps) {
  const { enabled, cachedRating, cachedCount, trustpilotUrl, businessUnitId, loaded } = useTrustpilot();
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetLoaded = useTrustpilotWidget(widgetRef, businessUnitId);

  if (!loaded || !enabled) return null;

  const templateId = variant === "compact"
    ? "5419b6ffb0d04a076446a9af"
    : "5419b637fa0340045cd0c936";

  return (
    <div>
      {businessUnitId && (
        <div ref={widgetRef} className="trustpilot-widget" data-locale="en-US"
          data-template-id={templateId} data-businessunit-id={businessUnitId}
          data-style-height={variant === "compact" ? "24px" : "52px"}
          data-style-width="100%" data-theme="light"
          style={{ display: widgetLoaded ? "block" : "none" }} />
      )}
      {!widgetLoaded && (
        variant === "compact"
          ? <FallbackCompact rating={cachedRating} url={trustpilotUrl} />
          : <FallbackFull rating={cachedRating} count={cachedCount} url={trustpilotUrl} />
      )}
    </div>
  );
}

function FallbackCompact({ rating, url }: { rating: number; url: string | null }) {
  const inner = (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg">
      <TrustpilotStars rating={rating} size="sm" />
      <span className="text-xs text-gray-600">
        <span className="font-semibold text-gray-900">{rating.toFixed(1)}</span>{" · Trustpilot"}
      </span>
    </div>
  );
  if (url) return <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">{inner}</a>;
  return inner;
}

function FallbackFull({ rating, count, url }: { rating: number; count: number; url: string | null }) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
      <div className="flex flex-col gap-1">
        <TrustpilotLogo className="text-sm" />
        <TrustpilotStars rating={rating} size="md" />
      </div>
      <div className="text-sm">
        <div className="font-semibold">{rating.toFixed(1)} / 5</div>
        <div className="text-muted-foreground text-xs">{count.toLocaleString()} reviews</div>
      </div>
    </div>
  );
  if (url) return <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-90 transition-opacity">{inner}</a>;
  return inner;
}
