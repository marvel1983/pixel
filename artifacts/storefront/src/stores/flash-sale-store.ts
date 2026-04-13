import { create } from "zustand";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface FlashSaleStore {
  prices: Map<number, string>;
  endsAt: string | null;
  loaded: boolean;
  load: () => void;
}

export const useFlashSaleStore = create<FlashSaleStore>((set, get) => ({
  prices: new Map(),
  endsAt: null,
  loaded: false,
  load: () => {
    if (get().loaded) return;
    set({ loaded: true });
    fetch(`${API}/flash-sales/active`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.sale?.products?.length) return;
        const map = new Map<number, string>();
        for (const p of d.sale.products) {
          map.set(p.variantId, p.salePriceUsd);
        }
        set({ prices: map, endsAt: d.sale.endsAt ?? null });
      })
      .catch(() => {});
  },
}));
