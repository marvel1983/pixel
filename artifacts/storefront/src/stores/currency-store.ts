import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "PLN", symbol: "zł", name: "Polish Złoty" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "TRY", symbol: "₺", name: "Turkish Lira" },
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
}

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
        const rate = rates[code] ?? 1;
        return usdAmount * rate;
      },

      format: (usdAmount) => {
        const { code, convert } = get();
        const converted = convert(usdAmount);
        const currency = SUPPORTED_CURRENCIES.find((c) => c.code === code);
        return `${currency?.symbol ?? "$"}${converted.toFixed(2)}`;
      },
    }),
    { name: "pixelcodes-currency" },
  ),
);
