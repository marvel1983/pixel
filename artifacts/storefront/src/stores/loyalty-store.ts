import { create } from "zustand";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface LoyaltyConfig {
  enabled: boolean;
  pointsPerDollar: number;
  redemptionRate: string;
  minRedeemPoints?: number;
  maxRedeemPercent?: number;
  tiers?: {
    BRONZE: { threshold: number; multiplier: string };
    SILVER: { threshold: number; multiplier: string };
    GOLD: { threshold: number; multiplier: string };
    PLATINUM: { threshold: number; multiplier: string };
  };
  bonuses?: {
    welcome?: number;
    review?: number;
    birthday?: number;
  };
}

export interface LoyaltyAccount {
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  tierMultiplier: number | string;
  currentTierThreshold?: number;
  nextTier?: string | null;
  nextTierThreshold?: number | null;
  pointsToNextTier?: number;
  discountValue?: number;
  expiringPoints?: number;
  earliestExpiryDate?: string | null;
}

export interface LoyaltyTransaction {
  id: number;
  type: string;
  points: number;
  balanceAfter?: number;
  balance?: number;
  description: string;
  createdAt: string;
  orderId?: number | null;
}

interface LoyaltyStore {
  config: LoyaltyConfig | null;
  loaded: boolean;
  account: LoyaltyAccount | null;
  transactions: LoyaltyTransaction[];
  transactionsTotal: number;
  accountLoading: boolean;
  load: () => Promise<void>;
  loadAccount: (token: string) => Promise<void>;
  loadTransactions: (token: string, page?: number, type?: string) => Promise<void>;
}

export const useLoyaltyStore = create<LoyaltyStore>((set, get) => ({
  config: null,
  loaded: false,
  account: null,
  transactions: [],
  transactionsTotal: 0,
  accountLoading: false,
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
  loadAccount: async (token: string) => {
    set({ accountLoading: true });
    try {
      const res = await fetch(`${API}/loyalty/account`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.enabled) {
          set({ account: data });
        } else {
          set({ account: null });
        }
      }
    } catch {
      // ignore
    } finally {
      set({ accountLoading: false });
    }
  },
  loadTransactions: async (token: string, page = 1, type = "ALL") => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(type !== "ALL" ? { type } : {}),
      });
      const res = await fetch(`${API}/loyalty/transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        set({
          transactions: data.transactions ?? [],
          transactionsTotal: data.total ?? (data.transactions?.length ?? 0),
        });
      }
    } catch {
      // ignore
    }
  },
}));
