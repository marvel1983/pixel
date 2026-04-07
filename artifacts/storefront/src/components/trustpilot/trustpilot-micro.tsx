import { useRef } from "react";
import { useTrustpilot, useTrustpilotWidget } from "@/hooks/use-trustpilot";
import { TrustpilotStars, TrustpilotLogo } from "./trustpilot-stars";

export function TrustpilotMicro() {
  const { enabled, cachedRating, cachedCount, trustpilotUrl, businessUnitId, loaded } = useTrustpilot();
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetLoaded = useTrustpilotWidget(widgetRef, businessUnitId);

  if (!loaded || !enabled) return null;

  return (
    <div>
      {businessUnitId && (
        <div ref={widgetRef} className="trustpilot-widget" data-locale="en-US"
          data-template-id="5419b6a8b0d04a076446a9ad" data-businessunit-id={businessUnitId}
          data-style-height="24px" data-style-width="100%" data-theme="dark"
          style={{ display: widgetLoaded ? "block" : "none" }} />
      )}
      {!widgetLoaded && (
        <FallbackMicro rating={cachedRating} count={cachedCount} url={trustpilotUrl} />
      )}
    </div>
  );
}

function FallbackMicro({ rating, count, url }: { rating: number; count: number; url: string | null }) {
  const content = (
    <div className="flex items-center gap-3">
      <TrustpilotLogo className="text-sm text-white" />
      <TrustpilotStars rating={rating} size="sm" />
      <span className="text-sm text-slate-300">
        <span className="font-semibold text-white">{rating.toFixed(1)}</span>
        {" / 5 · "}
        <span className="text-slate-400">{count.toLocaleString()} reviews</span>
      </span>
    </div>
  );
  if (url) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">{content}</a>;
  }
  return content;
}
