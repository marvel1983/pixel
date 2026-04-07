import { useState, useEffect, useCallback, useRef } from "react";

const API = import.meta.env.VITE_API_URL ?? "/api";

export interface SocialProofConfig {
  viewersEnabled: boolean;
  viewersMin: number;
  soldEnabled: boolean;
  soldMin: number;
  toastEnabled: boolean;
  toastIntervalMin: number;
  toastIntervalMax: number;
  toastMaxPerSession: number;
  stockUrgencyEnabled: boolean;
  stockLowThreshold: number;
  stockCriticalThreshold: number;
}

const defaultConfig: SocialProofConfig = {
  viewersEnabled: true, viewersMin: 3,
  soldEnabled: true, soldMin: 5,
  toastEnabled: true, toastIntervalMin: 45, toastIntervalMax: 90, toastMaxPerSession: 3,
  stockUrgencyEnabled: true, stockLowThreshold: 10, stockCriticalThreshold: 3,
};

let cachedConfig: SocialProofConfig | null = null;
let configPromise: Promise<SocialProofConfig> | null = null;

async function fetchConfig(): Promise<SocialProofConfig> {
  if (cachedConfig) return cachedConfig;
  if (configPromise) return configPromise;
  configPromise = fetch(`${API}/social-proof/config`)
    .then((r) => r.ok ? r.json() : defaultConfig)
    .then((c) => { cachedConfig = c; return c; })
    .catch(() => defaultConfig);
  return configPromise;
}

export function useSocialProofConfig() {
  const [config, setConfig] = useState<SocialProofConfig>(cachedConfig ?? defaultConfig);
  useEffect(() => { fetchConfig().then(setConfig); }, []);
  return config;
}

function getSessionId(): string {
  let sid = sessionStorage.getItem("sp_session");
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem("sp_session", sid); }
  return sid;
}

export function useViewerCount(productId: number) {
  const [viewers, setViewers] = useState(0);
  const config = useSocialProofConfig();

  useEffect(() => {
    if (!config.viewersEnabled) return;
    const sid = getSessionId();
    const track = () => fetch(`${API}/social-proof/view`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, sessionId: sid }),
    }).catch(() => {});
    const poll = () => fetch(`${API}/social-proof/viewers/${productId}`)
      .then((r) => r.json()).then((d) => setViewers(d.viewers)).catch(() => {});
    track(); poll();
    const interval = setInterval(() => { track(); poll(); }, 30000);
    return () => clearInterval(interval);
  }, [productId, config.viewersEnabled]);

  return { viewers, minThreshold: config.viewersMin, enabled: config.viewersEnabled };
}

export function useSoldCount(productId: number) {
  const [sold, setSold] = useState(0);
  const config = useSocialProofConfig();

  useEffect(() => {
    if (!config.soldEnabled) return;
    fetch(`${API}/social-proof/sold/${productId}`)
      .then((r) => r.json()).then((d) => setSold(d.sold)).catch(() => {});
  }, [productId, config.soldEnabled]);

  return { sold, minThreshold: config.soldMin, enabled: config.soldEnabled };
}

export interface RecentPurchase {
  productName: string;
  productImageUrl: string | null;
  customerName: string;
  customerCity: string | null;
  createdAt: string;
}

export function useRecentPurchases() {
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const config = useSocialProofConfig();

  useEffect(() => {
    if (!config.toastEnabled) return;
    fetch(`${API}/social-proof/recent-purchases?limit=10`)
      .then((r) => r.json()).then(setPurchases).catch(() => {});
  }, [config.toastEnabled]);

  return { purchases, config };
}

export function useStockUrgency(stockCount: number) {
  const config = useSocialProofConfig();
  if (!config.stockUrgencyEnabled || stockCount > config.stockLowThreshold) {
    return { show: false, label: "", variant: "default" as const };
  }
  if (stockCount <= config.stockCriticalThreshold) {
    return { show: true, label: "Almost gone!", variant: "critical" as const };
  }
  return { show: true, label: `Only ${stockCount} left!`, variant: "low" as const };
}
