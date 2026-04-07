import { create } from "zustand";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface LoyaltyConfig {
  enabled: boolean;
  pointsPerDollar: number;
  redemptionRate: string;
}

interface LoyaltyStore {
  config: LoyaltyConfig | null;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useLoyaltyStore = create<LoyaltyStore>((set, get) => ({
  config: null,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch(`${API}/loyalty/config`);
      const data = await res.json();
      set({ config: data.enabled ? data : null, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
