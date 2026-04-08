import { create } from "zustand";

const COOKIE_NAME = "pixelcodes_consent";
const API = import.meta.env.VITE_API_URL ?? "/api";

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

interface CookieConsentState {
  consent: CookieConsent | null;
  showBanner: boolean;
  showModal: boolean;
  setConsent: (consent: CookieConsent, action: string) => void;
  openModal: () => void;
  closeModal: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  loadFromCookie: () => void;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function logConsent(consent: CookieConsent, action: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const authState = JSON.parse(localStorage.getItem("auth-store") || "{}");
    if (authState?.state?.token) headers.Authorization = `Bearer ${authState.state.token}`;
  } catch {}
  fetch(`${API}/consent/log`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ ...consent, consentAction: action }),
  }).catch(() => {});
}

const ALL_ON: CookieConsent = { necessary: true, analytics: true, marketing: true, preferences: true };
const ALL_OFF: CookieConsent = { necessary: true, analytics: false, marketing: false, preferences: false };

export const useCookieConsentStore = create<CookieConsentState>((set) => ({
  consent: null,
  showBanner: false,
  showModal: false,

  loadFromCookie: () => {
    const raw = getCookie(COOKIE_NAME);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CookieConsent;
        set({ consent: { ...parsed, necessary: true }, showBanner: false });
      } catch {
        set({ showBanner: true });
      }
    } else {
      set({ showBanner: true });
    }
  },

  setConsent: (consent, action) => {
    const safe = { ...consent, necessary: true };
    const prev = useCookieConsentStore.getState().consent;
    setCookie(COOKIE_NAME, JSON.stringify(safe), 365);
    logConsent(safe, action);
    set({ consent: safe, showBanner: false, showModal: false });
    if (prev && (prev.analytics && !safe.analytics || prev.marketing && !safe.marketing)) {
      setTimeout(() => window.location.reload(), 300);
    }
  },

  openModal: () => set({ showModal: true }),
  closeModal: () => set({ showModal: false }),

  acceptAll: () => {
    setCookie(COOKIE_NAME, JSON.stringify(ALL_ON), 365);
    logConsent(ALL_ON, "accept_all");
    set({ consent: ALL_ON, showBanner: false, showModal: false });
  },

  rejectAll: () => {
    const prev = useCookieConsentStore.getState().consent;
    setCookie(COOKIE_NAME, JSON.stringify(ALL_OFF), 365);
    logConsent(ALL_OFF, "reject_all");
    set({ consent: ALL_OFF, showBanner: false, showModal: false });
    if (prev && (prev.analytics || prev.marketing)) {
      setTimeout(() => window.location.reload(), 300);
    }
  },
}));
