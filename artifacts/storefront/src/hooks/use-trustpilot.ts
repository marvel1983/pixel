import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export interface TrustpilotConfig {
  enabled: boolean;
  businessUnitId: string | null;
  trustpilotUrl: string | null;
  cachedRating: number;
  cachedCount: number;
}

let cachedConfig: TrustpilotConfig | null = null;
let fetchPromise: Promise<TrustpilotConfig> | null = null;
let widgetScriptStatus: "idle" | "loading" | "loaded" | "failed" = "idle";

function fetchConfig(): Promise<TrustpilotConfig> {
  if (!fetchPromise) {
    fetchPromise = fetch(`${API}/trustpilot/config`)
      .then((r) => r.json())
      .then((data: TrustpilotConfig) => { cachedConfig = data; return data; })
      .catch(() => {
        cachedConfig = { enabled: false, businessUnitId: null, trustpilotUrl: null, cachedRating: 4.7, cachedCount: 2847 };
        return cachedConfig;
      });
  }
  return fetchPromise;
}

export function loadTrustpilotWidget(): Promise<boolean> {
  if (widgetScriptStatus === "loaded") return Promise.resolve(true);
  if (widgetScriptStatus === "failed") return Promise.resolve(false);
  if (widgetScriptStatus === "loading") {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (widgetScriptStatus === "loaded") { clearInterval(check); resolve(true); }
        if (widgetScriptStatus === "failed") { clearInterval(check); resolve(false); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(false); }, 5000);
    });
  }

  widgetScriptStatus = "loading";
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";
    script.async = true;
    script.onload = () => { widgetScriptStatus = "loaded"; resolve(true); };
    script.onerror = () => { widgetScriptStatus = "failed"; resolve(false); };
    document.head.appendChild(script);
    setTimeout(() => {
      if (widgetScriptStatus === "loading") { widgetScriptStatus = "failed"; resolve(false); }
    }, 5000);
  });
}

export function useTrustpilot() {
  const [config, setConfig] = useState<TrustpilotConfig>(
    cachedConfig ?? { enabled: false, businessUnitId: null, trustpilotUrl: null, cachedRating: 4.7, cachedCount: 2847 }
  );
  const [loaded, setLoaded] = useState(!!cachedConfig);
  const [widgetAvailable, setWidgetAvailable] = useState(widgetScriptStatus === "loaded");

  useEffect(() => {
    if (cachedConfig) { setConfig(cachedConfig); setLoaded(true); } else {
      fetchConfig().then((c) => { setConfig(c); setLoaded(true); });
    }
  }, []);

  return { ...config, loaded, widgetAvailable, setWidgetAvailable };
}

export function useTrustpilotWidget(containerRef: React.RefObject<HTMLElement | null>, businessUnitId: string | null) {
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !businessUnitId || !containerRef.current) return;
    attempted.current = true;
    loadTrustpilotWidget().then((ok) => {
      if (ok && window.Trustpilot && containerRef.current) {
        try {
          window.Trustpilot.loadFromElement(containerRef.current, true);
          setWidgetLoaded(true);
        } catch { setWidgetLoaded(false); }
      }
    });
  }, [businessUnitId, containerRef]);

  return widgetLoaded;
}

declare global {
  interface Window { Trustpilot?: { loadFromElement: (el: HTMLElement, force?: boolean) => void } }
}
