import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistState {
  productIds: number[];
  addProduct: (id: number) => void;
  removeProduct: (id: number) => void;
  toggleProduct: (id: number) => void;
  hasProduct: (id: number) => boolean;
  clearAll: () => void;
  syncWithServer: (token: string) => Promise<void>;
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

      syncWithServer: async (token: string) => {
        try {
          const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
          const res = await fetch(`${baseUrl}/wishlist/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
            body: JSON.stringify({ productIds: get().productIds }),
          });
          if (res.ok) {
            const data = await res.json();
            set({ productIds: data.productIds });
          }
        } catch {
          // keep local state on failure
        }
      },
    }),
    { name: "pixelcodes-wishlist" },
  ),
);
