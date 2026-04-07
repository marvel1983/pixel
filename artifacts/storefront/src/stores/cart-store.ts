import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  priceUsd: string;
  quantity: number;
  platform?: string;
  bundleId?: number;
  bundleName?: string;
  originalPriceUsd?: string;
}

export interface CouponData {
  code: string;
  pct: number;
  label: string;
}

interface CartState {
  items: CartItem[];
  coupon: CouponData | null;
  addItem: (item: Omit<CartItem, "quantity">) => void;
  addBundleItems: (bundleId: number, bundleName: string, items: Omit<CartItem, "quantity" | "bundleId" | "bundleName">[]) => void;
  removeBundleItems: (bundleId: number) => void;
  removeItem: (variantId: number, bundleId?: number) => void;
  updateQuantity: (variantId: number, quantity: number, bundleId?: number) => void;
  clearCart: () => void;
  setCoupon: (coupon: CouponData | null) => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId && !i.bundleId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId && !i.bundleId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity: 1 }] };
        }),

      addBundleItems: (bundleId, bundleName, bundleItems) =>
        set((state) => {
          const withoutBundle = state.items.filter((i) => i.bundleId !== bundleId);
          const newItems = bundleItems.map((item) => ({
            ...item,
            quantity: 1,
            bundleId,
            bundleName,
          }));
          return { items: [...withoutBundle, ...newItems] };
        }),

      removeBundleItems: (bundleId) =>
        set((state) => ({
          items: state.items.filter((i) => i.bundleId !== bundleId),
        })),

      removeItem: (variantId, bundleId) =>
        set((state) => ({
          items: state.items.filter((i) => !(i.variantId === variantId && i.bundleId === bundleId)),
        })),

      updateQuantity: (variantId, quantity, bundleId) =>
        set((state) => {
          if (bundleId) {
            return {
              items: quantity <= 0
                ? state.items.filter((i) => i.bundleId !== bundleId)
                : state.items.map((i) => i.bundleId === bundleId ? { ...i, quantity } : i),
            };
          }
          const match = (i: CartItem) => i.variantId === variantId && !i.bundleId;
          return {
            items: quantity <= 0
              ? state.items.filter((i) => !match(i))
              : state.items.map((i) => match(i) ? { ...i, quantity } : i),
          };
        }),

      clearCart: () => set({ items: [], coupon: null }),

      setCoupon: (coupon) => set({ coupon }),

      getTotal: () =>
        get().items.reduce(
          (sum, item) => sum + parseFloat(item.priceUsd) * item.quantity,
          0,
        ),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "pixelcodes-cart" },
  ),
);
