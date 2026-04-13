import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸", name: "US Dollar" },
  { code: "EUR", symbol: "€", flag: "🇪🇺", name: "Euro" },
  { code: "GBP", symbol: "£", flag: "🇬🇧", name: "British Pound" },
  { code: "PLN", symbol: "zł", flag: "🇵🇱", name: "Polish Złoty" },
  { code: "CZK", symbol: "Kč", flag: "🇨🇿", name: "Czech Koruna" },
  { code: "HUF", symbol: "Ft", flag: "🇭🇺", name: "Hungarian Forint" },
  { code: "CAD", symbol: "C$", flag: "🇨🇦", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", flag: "🇦🇺", name: "Australian Dollar" },
  { code: "BRL", symbol: "R$", flag: "🇧🇷", name: "Brazilian Real" },
  { code: "TRY", symbol: "₺", flag: "🇹🇷", name: "Turkish Lira" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const BASE_CURRENCY = "USD";

// Build a fresh `format` function that captures current code+rates.
// Called on every setCode / setRates so components subscribed to `format`
// get a NEW reference and re-render atomically.
function buildFormat(
  code: CurrencyCode,
  rates: Record<string, number>,
): (baseAmount: number) => string {
  return (baseAmount: number) => {
    const hasRate = code === BASE_CURRENCY || !!rates[code];
    const displayCode = hasRate ? code : BASE_CURRENCY;
    const rate = displayCode === BASE_CURRENCY ? 1 : (rates[displayCode] ?? 1);
    const converted = baseAmount * rate;
    const currency = SUPPORTED_CURRENCIES.find((c) => c.code === displayCode);
    if (displayCode === "HUF" || displayCode === "CZK") {
      return `${Math.round(converted)} ${currency?.symbol ?? displayCode}`;
    }
    return `${currency?.symbol ?? "$"}${converted.toFixed(2)}`;
  };
}

interface CurrencyState {
  code: CurrencyCode;
  rates: Record<string, number>;
  lastFetched: number | null;
  /** Reactive: new reference every time code or rates change — triggers re-renders */
  format: (baseAmount: number) => string;
  setCode: (code: CurrencyCode) => void;
  setRates: (rates: Record<string, number>) => void;
  convert: (baseAmount: number) => number;
  fetchRates: () => Promise<void>;
}

const RATE_CACHE_MS = 60 * 60 * 1000;

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      code: BASE_CURRENCY as CurrencyCode,
      rates: {},
      lastFetched: null,
      format: buildFormat(BASE_CURRENCY as CurrencyCode, {}),

      setCode: (code) => {
        const { rates } = get();
        set({ code, format: buildFormat(code, rates) });
      },

      setRates: (rates) => {
        const { code } = get();
        set({ rates, lastFetched: Date.now(), format: buildFormat(code, rates) });
      },

      convert: (baseAmount) => {
        const { code, rates } = get();
        if (code === BASE_CURRENCY) return baseAmount;
        const rate = rates[code];
        if (!rate) return baseAmount;
        return baseAmount * rate;
      },

      fetchRates: async () => {
        const { lastFetched, rates } = get();
        const hasRates = Object.keys(rates).length > 0;
        if (hasRates && lastFetched && Date.now() - lastFetched < RATE_CACHE_MS) return;
        try {
          const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
          const res = await fetch(`${baseUrl}/currencies`);
          if (res.ok) {
            const data = await res.json();
            get().setRates(data.rates);
          }
        } catch {
          // keep cached rates on failure
        }
      },
    }),
    {
      name: "pixelcodes-currency",
      // Don't persist `format` (it's a function — not serialisable).
      // Rebuild it from persisted code+rates on rehydration.
      partialize: (s) => ({ code: s.code, rates: s.rates, lastFetched: s.lastFetched }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.format = buildFormat(state.code, state.rates);
        }
      },
    },
  ),
);
