import { useCartStore, type CartItem, type CouponData } from "../../stores/cart-store";
import { useCurrencyStore } from "../../stores/currency-store";
import { track, captureSnapshot, flush } from "./client";
import type { CartSnapshotPayload } from "./types";

interface SnapshotKey {
  variantId: number;
  bundleId?: number;
}

function keyOf(i: SnapshotKey): string {
  return `${i.variantId}:${i.bundleId ?? 0}`;
}

function buildSnapshot(
  triggerEvent: string,
  items: CartItem[],
  coupon: CouponData | null,
): CartSnapshotPayload {
  const subtotal = items.reduce(
    (sum, i) => sum + parseFloat(i.priceUsd) * i.quantity,
    0,
  );
  const discountPct = coupon?.pct ?? 0;
  const discount = subtotal * (discountPct / 100);
  const total = subtotal - discount;
  const currency = useCurrencyStore.getState().code ?? "EUR";

  return {
    triggerEvent,
    capturedAt: new Date().toISOString(),
    items: items.map((i) => ({
      variantId: i.variantId,
      productId: i.productId,
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      priceUsd: i.priceUsd,
      imageUrl: i.imageUrl ?? undefined,
    })),
    totals: {
      subtotalUsd: subtotal.toFixed(2),
      discountUsd: discount.toFixed(2),
      taxUsd: "0",
      totalUsd: total.toFixed(2),
      currency,
      couponCode: coupon?.code,
    },
  };
}

let prevItems: CartItem[] = [];
let prevCoupon: CouponData | null = null;
let started = false;
let suppressNext = false;

/**
 * Tells the cart tracker to skip the next subscribe firing — used after
 * a successful checkout to avoid recording the post-success clearCart()
 * as a user-initiated remove_from_cart.
 */
export function suppressNextCartChange(): void {
  suppressNext = true;
}

export function startCartTracker(): void {
  if (started) return;
  started = true;
  prevItems = useCartStore.getState().items;
  prevCoupon = useCartStore.getState().coupon;

  useCartStore.subscribe((state) => {
    const nextItems = state.items;
    const nextCoupon = state.coupon;

    if (suppressNext) {
      suppressNext = false;
      prevItems = nextItems;
      prevCoupon = nextCoupon;
      return;
    }

    const prevMap = new Map(prevItems.map((i) => [keyOf(i), i]));
    const nextMap = new Map(nextItems.map((i) => [keyOf(i), i]));

    let trigger: string | null = null;

    for (const [k, item] of nextMap) {
      const before = prevMap.get(k);
      if (!before) {
        track("add_to_cart", {
          variantId: item.variantId,
          productId: item.productId,
          quantity: item.quantity,
          bundleId: item.bundleId,
        });
        trigger = "add_to_cart";
      } else if (before.quantity !== item.quantity) {
        track("update_cart_qty", {
          variantId: item.variantId,
          from: before.quantity,
          to: item.quantity,
        });
        trigger = trigger ?? "update_cart_qty";
      }
    }
    for (const [k, item] of prevMap) {
      if (!nextMap.has(k)) {
        track("remove_from_cart", {
          variantId: item.variantId,
          productId: item.productId,
        });
        trigger = trigger ?? "remove_from_cart";
      }
    }

    if (prevCoupon?.code !== nextCoupon?.code) {
      if (nextCoupon) {
        track("apply_coupon", { code: nextCoupon.code, pct: nextCoupon.pct });
        trigger = trigger ?? "apply_coupon";
      }
    }

    if (trigger) {
      captureSnapshot(buildSnapshot(trigger, nextItems, nextCoupon));
      // Cart events are high-value and often happen right before navigation.
      // Flush immediately rather than waiting on the buffer timer so events
      // aren't lost if sendBeacon fails during teardown.
      void flush(false);
    }

    prevItems = nextItems;
    prevCoupon = nextCoupon;
  });
}

export function captureCartSnapshotForTrigger(triggerEvent: string): void {
  const { items, coupon } = useCartStore.getState();
  if (items.length === 0) return;
  captureSnapshot(buildSnapshot(triggerEvent, items, coupon));
}
