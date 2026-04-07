import { useTrustpilot } from "@/hooks/use-trustpilot";
import { TrustpilotStars, TrustpilotLogo } from "./trustpilot-stars";

export function TrustpilotMicro() {
  const { enabled, cachedRating, cachedCount, trustpilotUrl, loaded } = useTrustpilot();

  if (!loaded || !enabled) return null;

  const content = (
    <div className="flex items-center gap-3">
      <TrustpilotLogo className="text-sm text-white" />
      <TrustpilotStars rating={cachedRating} size="sm" />
      <span className="text-sm text-slate-300">
        <span className="font-semibold text-white">{cachedRating.toFixed(1)}</span>
        {" / 5 · "}
        <span className="text-slate-400">{cachedCount.toLocaleString()} reviews</span>
      </span>
    </div>
  );

  if (trustpilotUrl) {
    return (
      <a href={trustpilotUrl} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
        {content}
      </a>
    );
  }

  return content;
}
