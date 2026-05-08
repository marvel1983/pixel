import { useCookieConsentStore } from "../../stores/cookie-consent-store";
import { getSessionId, touchSession } from "./session";
import type {
  TrackingEvent,
  TrackingEventType,
  CartSnapshotPayload,
  SessionInitPayload,
  TrackBatchBody,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";
const FLUSH_DELAY_MS = 5000;
const MAX_BUFFER = 20;
const SESSION_INIT_KEY = "pixelcodes_session_init_sent";

function detectDeviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = window.navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function buildSessionInit(): SessionInitPayload | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    if (window.sessionStorage.getItem(SESSION_INIT_KEY) === "1") return undefined;
  } catch {
    // sessionStorage unavailable — skip dedup, still ship init
  }
  const params = new URLSearchParams(window.location.search);
  const init: SessionInitPayload = {
    referrer: document.referrer || null,
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    deviceType: detectDeviceType(),
  };
  try {
    window.sessionStorage.setItem(SESSION_INIT_KEY, "1");
  } catch {
    // ignore
  }
  return init;
}

function consentGranted(): boolean {
  const c = useCookieConsentStore.getState().consent;
  return !!c?.analytics;
}

let eventBuffer: TrackingEvent[] = [];
let snapshotBuffer: CartSnapshotPayload[] = [];
let pendingInit: SessionInitPayload | undefined;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initShipped = false;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush(false);
  }, FLUSH_DELAY_MS);
}

function clearTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

export async function flush(useBeacon = false): Promise<void> {
  if (!consentGranted()) {
    eventBuffer = [];
    snapshotBuffer = [];
    return;
  }
  if (eventBuffer.length === 0 && snapshotBuffer.length === 0) return;

  clearTimer();

  const sessionId = getSessionId();
  const body: TrackBatchBody = {
    events: eventBuffer,
    snapshots: snapshotBuffer.length ? snapshotBuffer : undefined,
    sessionInit: pendingInit,
  };

  eventBuffer = [];
  snapshotBuffer = [];
  if (pendingInit) {
    initShipped = true;
    pendingInit = undefined;
  }

  const payload = JSON.stringify(body);
  const url = `${API_BASE}/track`;

  if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" }),
      );
      return;
    } catch {
      // fall through to fetch
    }
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Id": sessionId,
      },
      credentials: "include",
      keepalive: useBeacon,
      body: payload,
    });
  } catch {
    // best-effort: drop on failure
  }
}

function ensureInit() {
  if (initShipped || pendingInit) return;
  pendingInit = buildSessionInit();
  if (pendingInit) initShipped = false;
}

export function track(
  eventType: TrackingEventType,
  metadata?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!consentGranted()) return;

  touchSession();
  ensureInit();

  eventBuffer.push({
    eventType,
    occurredAt: new Date().toISOString(),
    pagePath: window.location.pathname || null,
    metadata: metadata ?? null,
  });

  if (eventBuffer.length + snapshotBuffer.length >= MAX_BUFFER) {
    void flush(false);
    return;
  }
  scheduleFlush();
}

export function captureSnapshot(snapshot: CartSnapshotPayload): void {
  if (typeof window === "undefined") return;
  if (!consentGranted()) return;
  touchSession();
  ensureInit();
  snapshotBuffer.push(snapshot);
  if (eventBuffer.length + snapshotBuffer.length >= MAX_BUFFER) {
    void flush(false);
    return;
  }
  scheduleFlush();
}

export function flushNowWithBeacon(): void {
  void flush(true);
}
