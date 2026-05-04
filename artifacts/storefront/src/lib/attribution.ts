const KEY = "px_attr";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  _ts?: number; // timestamp for TTL
}

/**
 * Call once on app startup.
 * Rules:
 *  - A new utm_source always wins (paid/campaign traffic is explicit).
 *  - A new referrer wins only if there's no existing attribution or existing is expired.
 *  - Stripe/PayPal redirect-back never overwrites (no UTMs, no external referrer).
 *  - Attribution persists 30 days in localStorage.
 */
export function captureAttribution(): void {
  try {
    const p = new URLSearchParams(window.location.search);
    const src = p.get("utm_source");
    const med = p.get("utm_medium");
    const cmp = p.get("utm_campaign");
    const ref = document.referrer;
    const externalRef = ref && !ref.includes(window.location.hostname) ? ref.slice(0, 300) : undefined;

    const existing = loadStored();
    const hasIncoming = !!(src || externalRef);

    // Always overwrite when a utm_source is present (explicit campaign traffic)
    // Overwrite with referrer only if nothing is stored or existing is expired
    if (src) {
      const attr: Attribution = { _ts: Date.now() };
      if (src) attr.utm_source = src.slice(0, 100);
      if (med) attr.utm_medium = med.slice(0, 100);
      if (cmp) attr.utm_campaign = cmp.slice(0, 100);
      if (externalRef) attr.referrer = externalRef;
      localStorage.setItem(KEY, JSON.stringify(attr));
      return;
    }

    if (!existing && externalRef) {
      // First visit with a referrer and no prior attribution
      localStorage.setItem(KEY, JSON.stringify({ referrer: externalRef, _ts: Date.now() }));
      return;
    }

    if (!existing && !hasIncoming) {
      // Direct traffic — store empty with timestamp so we know it was captured
      localStorage.setItem(KEY, JSON.stringify({ _ts: Date.now() }));
    }
  } catch { /* localStorage blocked */ }
}

function loadStored(): Attribution | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const attr = JSON.parse(s) as Attribution;
    if (attr._ts && Date.now() - attr._ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return attr;
  } catch {
    return null;
  }
}

/** Returns stored attribution, or undefined if none / direct / expired. */
export function getAttribution(): Attribution | undefined {
  const attr = loadStored();
  if (!attr) return undefined;
  const { _ts, ...rest } = attr;
  return Object.keys(rest).length > 0 ? rest : undefined;
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
