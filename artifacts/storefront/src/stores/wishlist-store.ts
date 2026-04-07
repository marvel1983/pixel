import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  productIds: number[];
  addProduct: (id: number) => void;
  removeProduct: (id: number) => void;
  toggleProduct: (id: number) => void;
  hasProduct: (id: number) => boolean;
  clearAll: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],

      addProduct: (id) =>
        set((state) => {
          if (state.productIds.includes(id)) return state;
          return { productIds: [...state.productIds, id] };
        }),

      removeProduct: (id) =>
        set((state) => ({
          productIds: state.productIds.filter((pid) => pid !== id),
        })),

      toggleProduct: (id) => {
        const { productIds } = get();
        if (productIds.includes(id)) {
          set({ productIds: productIds.filter((pid) => pid !== id) });
        } else {
          set({ productIds: [...productIds, id] });
        }
      },

      hasProduct: (id) => get().productIds.includes(id),

      clearAll: () => set({ productIds: [] }),
    }),
    { name: "pixelcodes-wishlist" },
  ),
);
