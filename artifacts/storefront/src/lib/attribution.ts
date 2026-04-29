const KEY = "px_attr";

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
}

/** Call once on app startup. Captures UTM params + referrer on first landing only. */
export function captureAttribution(): void {
  try {
    // Use !== null so an empty "{}" stored for direct traffic still blocks re-capture on Stripe redirect-back
    if (sessionStorage.getItem(KEY) !== null) return;
    const p = new URLSearchParams(window.location.search);
    const attr: Attribution = {};
    const src = p.get("utm_source"); if (src) attr.utm_source = src.slice(0, 100);
    const med = p.get("utm_medium"); if (med) attr.utm_medium = med.slice(0, 100);
    const cmp = p.get("utm_campaign"); if (cmp) attr.utm_campaign = cmp.slice(0, 100);
    const ref = document.referrer;
    if (ref && !ref.includes(window.location.hostname)) attr.referrer = ref.slice(0, 300);
    // Always store — even empty — so returning from checkout.stripe.com can't overwrite this
    sessionStorage.setItem(KEY, JSON.stringify(attr));
  } catch { /* sessionStorage blocked */ }
}

/** Returns stored attribution for the current session, or undefined. */
export function getAttribution(): Attribution | undefined {
  try {
    const s = sessionStorage.getItem(KEY);
    if (!s) return undefined;
    const attr = JSON.parse(s) as Attribution;
    return Object.keys(attr).length > 0 ? attr : undefined;
  } catch {
    return undefined;
  }
}

/** Returns a short human-readable source label. */
export function formatSource(attr?: Attribution | null): string {
  if (!attr) return "Direct";
  const src = attr.utm_source?.toLowerCase();
  const med = attr.utm_medium?.toLowerCase();
  if (src) {
    if (src === "google" && med === "cpc") return "Google Ads";
    if (src === "google" && med === "shopping") return "Google Shopping";
    if (src === "facebook" || src === "fb") return med === "cpc" ? "Facebook Ads" : "Facebook";
    if (src === "instagram") return "Instagram";
    if (src === "bing" && med === "cpc") return "Bing Ads";
    return attr.utm_medium ? `${src} / ${attr.utm_medium}` : src;
  }
  if (attr.referrer) {
    try {
      const host = new URL(attr.referrer).hostname.replace(/^www\./, "");
      if (host.includes("google.")) return "Google Organic";
      if (host.includes("bing.com")) return "Bing";
      if (host.includes("facebook.com") || host.includes("fb.com")) return "Facebook";
      if (host.includes("twitter.com") || host === "t.co") return "Twitter/X";
      if (host.includes("instagram.com")) return "Instagram";
      if (host.includes("tiktok.com")) return "TikTok";
      if (host.includes("youtube.com")) return "YouTube";
      return host;
    } catch { /* malformed URL */ }
  }
  return "Direct";
}
