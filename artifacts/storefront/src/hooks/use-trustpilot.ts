import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface TrustpilotConfig {
  enabled: boolean;
  businessUnitId: string | null;
  trustpilotUrl: string | null;
  cachedRating: number;
  cachedCount: number;
}

let cachedConfig: TrustpilotConfig | null = null;
let fetchPromise: Promise<TrustpilotConfig> | null = null;

function fetchConfig(): Promise<TrustpilotConfig> {
  if (!fetchPromise) {
    fetchPromise = fetch(`${API}/trustpilot/config`)
      .then((r) => r.json())
      .then((data) => {
        cachedConfig = data;
        return data;
      })
      .catch(() => {
        cachedConfig = { enabled: false, businessUnitId: null, trustpilotUrl: null, cachedRating: 4.7, cachedCount: 2847 };
        return cachedConfig;
      });
  }
  return fetchPromise;
}

export function useTrustpilot() {
  const [config, setConfig] = useState<TrustpilotConfig>(
    cachedConfig ?? { enabled: false, businessUnitId: null, trustpilotUrl: null, cachedRating: 4.7, cachedCount: 2847 }
  );
  const [loaded, setLoaded] = useState(!!cachedConfig);

  useEffect(() => {
    if (cachedConfig) { setConfig(cachedConfig); setLoaded(true); return; }
    fetchConfig().then((c) => { setConfig(c); setLoaded(true); });
  }, []);

  return { ...config, loaded };
}
