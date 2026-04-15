import { useState, useEffect } from "react";

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

// ─── Global batch registry ────────────────────────────────────────────────────
// All product cards register here. A single debounced fetch fires one batched
// request instead of one request per card, and one shared interval polls.

type Listener = (value: number) => void;

const viewerListeners = new Map<number, Set<Listener>>();
const soldListeners = new Map<number, Set<Listener>>();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

function getRegisteredIds(): number[] {
  const ids = new Set<number>();
  for (const pid of viewerListeners.keys()) ids.add(pid);
  for (const pid of soldListeners.keys()) ids.add(pid);
  return [...ids];
}

async function fetchBatch() {
  const ids = getRegisteredIds();
  if (ids.length === 0) return;
  try {
    const data = await fetch(`${API}/social-proof/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: ids, sessionId: getSessionId() }),
    }).then((r) => r.json()) as { viewers: Record<number, number>; sold: Record<number, number> };

    for (const [pid, callbacks] of viewerListeners) {
      callbacks.forEach((cb) => cb(data.viewers[pid] ?? 0));
    }
    for (const [pid, callbacks] of soldListeners) {
      callbacks.forEach((cb) => cb(data.sold[pid] ?? 0));
    }
  } catch { /* ignore */ }
}

function scheduleFlush() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    fetchBatch();
    if (!pollInterval) {
      pollInterval = setInterval(fetchBatch, 30_000);
    }
  }, 50);
}

function addListener(map: Map<number, Set<Listener>>, id: number, fn: Listener) {
  if (!map.has(id)) map.set(id, new Set());
  map.get(id)!.add(fn);
}

function removeListener(map: Map<number, Set<Listener>>, id: number, fn: Listener) {
  map.get(id)?.delete(fn);
  if (map.get(id)?.size === 0) map.delete(id);
}

function stopPollIfIdle() {
  if (getRegisteredIds().length === 0 && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useViewerCount(productId: number) {
  const [viewers, setViewers] = useState(0);
  const config = useSocialProofConfig();

  useEffect(() => {
    if (!config.viewersEnabled) return;
    addListener(viewerListeners, productId, setViewers);
    scheduleFlush();
    return () => {
      removeListener(viewerListeners, productId, setViewers);
      stopPollIfIdle();
    };
  }, [productId, config.viewersEnabled]);

  return { viewers, minThreshold: config.viewersMin, enabled: config.viewersEnabled };
}

export function useSoldCount(productId: number) {
  const [sold, setSold] = useState(0);
  const config = useSocialProofConfig();

  useEffect(() => {
    if (!config.soldEnabled) return;
    addListener(soldListeners, productId, setSold);
    scheduleFlush();
    return () => {
      removeListener(soldListeners, productId, setSold);
      stopPollIfIdle();
    };
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
