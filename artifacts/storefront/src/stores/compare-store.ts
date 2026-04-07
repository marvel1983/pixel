import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CompareState {
  productIds: number[];
  addProduct: (id: number) => void;
  removeProduct: (id: number) => void;
  clearAll: () => void;
  hasProduct: (id: number) => boolean;
}

const MAX_COMPARE = 4;

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      productIds: [],

      addProduct: (id) =>
        set((state) => {
          if (state.productIds.includes(id)) return state;
          if (state.productIds.length >= MAX_COMPARE) return state;
          return { productIds: [...state.productIds, id] };
        }),

      removeProduct: (id) =>
        set((state) => ({
          productIds: state.productIds.filter((pid) => pid !== id),
        })),

      clearAll: () => set({ productIds: [] }),

      hasProduct: (id) => get().productIds.includes(id),
    }),
    { name: "pixelcodes-compare" },
  ),
);
