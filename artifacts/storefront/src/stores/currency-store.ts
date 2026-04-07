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

interface CurrencyState {
  code: CurrencyCode;
  rates: Record<string, number>;
  lastFetched: number | null;
  setCode: (code: CurrencyCode) => void;
  setRates: (rates: Record<string, number>) => void;
  convert: (usdAmount: number) => number;
  format: (usdAmount: number) => string;
  fetchRates: () => Promise<void>;
}

const RATE_CACHE_MS = 60 * 60 * 1000;

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      code: "USD",
      rates: {},
      lastFetched: null,

      setCode: (code) => set({ code }),

      setRates: (rates) => set({ rates, lastFetched: Date.now() }),

      convert: (usdAmount) => {
        const { code, rates } = get();
        if (code === "USD") return usdAmount;
        const rate = rates[code];
        if (!rate) return usdAmount;
        return usdAmount * rate;
      },

      format: (usdAmount) => {
        const { code, rates } = get();
        const hasRate = code === "USD" || !!rates[code];
        const displayCode = hasRate ? code : "USD";
        const converted = get().convert(usdAmount);
        const currency = SUPPORTED_CURRENCIES.find((c) => c.code === displayCode);
        if (displayCode === "HUF" || displayCode === "CZK") {
          return `${Math.round(converted)} ${currency?.symbol ?? displayCode}`;
        }
        return `${currency?.symbol ?? "$"}${converted.toFixed(2)}`;
      },

      fetchRates: async () => {
        const { lastFetched } = get();
        if (lastFetched && Date.now() - lastFetched < RATE_CACHE_MS) return;
        try {
          const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
          const res = await fetch(`${baseUrl}/currencies`);
          if (res.ok) {
            const data = await res.json();
            set({ rates: data.rates, lastFetched: Date.now() });
          }
        } catch {
          // keep cached rates on failure
        }
      },
    }),
    { name: "pixelcodes-currency" },
  ),
);
