import { create } from "zustand";
import { persist } from "zustand/middleware";

const API_BASE = () => import.meta.env.VITE_API_URL ?? "/api";

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem("pixelcodes-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(token?: string): Record<string, string> {
  const t = token ?? getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (t) headers["Authorization"] = `Bearer ${t}`;
  return headers;
}

interface WishlistState {
  productIds: number[];
  addProduct: (id: number) => void;
  removeProduct: (id: number) => void;
  toggleProduct: (id: number) => void;
  hasProduct: (id: number) => boolean;
  clearAll: () => void;
  clearLocal: () => void;
  syncWithServer: (token: string) => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],

      addProduct: (id) => {
        const { productIds } = get();
        if (productIds.includes(id)) return;
        set({ productIds: [...productIds, id] });
        const token = getAuthToken();
        if (token) {
          fetch(`${API_BASE()}/wishlist`, {
            method: "POST",
            headers: authHeaders(token),
            credentials: "include",
            body: JSON.stringify({ productId: id }),
          }).catch(() => {});
        }
      },

      removeProduct: (id) => {
        set((s) => ({ productIds: s.productIds.filter((pid) => pid !== id) }));
        const token = getAuthToken();
        if (token) {
          fetch(`${API_BASE()}/wishlist/${id}`, {
            method: "DELETE",
            headers: authHeaders(token),
            credentials: "include",
          }).catch(() => {});
        }
      },

      toggleProduct: (id) => {
        const { productIds, addProduct, removeProduct } = get();
        if (productIds.includes(id)) {
          removeProduct(id);
        } else {
          addProduct(id);
        }
      },

      hasProduct: (id) => get().productIds.includes(id),

      clearAll: () => {
        const { productIds } = get();
        set({ productIds: [] });
        const token = getAuthToken();
        if (token) {
          productIds.forEach((id) => {
            fetch(`${API_BASE()}/wishlist/${id}`, {
              method: "DELETE",
              headers: authHeaders(token),
              credentials: "include",
            }).catch(() => {});
          });
        }
      },

      clearLocal: () => set({ productIds: [] }),

      syncWithServer: async (token: string) => {
        try {
          const res = await fetch(`${API_BASE()}/wishlist/sync`, {
            method: "POST",
            headers: authHeaders(token),
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
