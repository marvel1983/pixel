import { useEffect, useRef, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BillingData } from "@/components/checkout/billing-form";
import type { CartItem } from "@/stores/cart-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface TaxInfo { taxRate: number; taxLabel: string; exempt: boolean; b2bEnabled: boolean; priceDisplay: string }
interface ProcessingFeeTier { minAmount: number; feePercent: number; feeFixed: number }
interface CheckoutConfig { cppEnabled: boolean; cppLabel: string; cppPrice: string; cppDescription: string; processingFeePercent: string; processingFeeFixed: string; processingFeeTiers: ProcessingFeeTier[] }

interface Params {
  items: CartItem[];
  billing: BillingData;
  token: string | null;
  coupon: { code: string } | null;
  updateItemPrice: (variantId: number, priceUsd: string) => void;
  setBilling: Dispatch<SetStateAction<BillingData>>;
  setTaxInfo: Dispatch<SetStateAction<TaxInfo>>;
  setCheckoutConfig: Dispatch<SetStateAction<CheckoutConfig>>;
  setConfigLoaded: Dispatch<SetStateAction<boolean>>;
  getTotal: () => number;
}

export function useCheckoutSetup({ items, billing, token, coupon, updateItemPrice, setBilling, setTaxInfo, setCheckoutConfig, setConfigLoaded, getTotal }: Params) {
  const billingPrefilledRef = useRef(false);
  const capturedRef = useRef("");

  const cartPriceSyncKey = useMemo(
    () => items.filter((i) => !i.bundleId && i.variantId > 0).map((i) => `${i.variantId}:${i.quantity}`).sort().join("|"),
    [items],
  );

  useEffect(() => {
    if (!cartPriceSyncKey) return;
    let cancelled = false;
    (async () => {
      const lines = items.filter((i) => !i.bundleId && i.variantId > 0);
      for (const item of lines) {
        try {
          const r = await fetch(`${API}/variants/${item.variantId}/price?qty=${item.quantity}`);
          if (!r.ok || cancelled) continue;
          const d = (await r.json()) as { price?: { effectiveUnitPriceUsd?: string } };
          const next = d?.price?.effectiveUnitPriceUsd;
          if (next) updateItemPrice(item.variantId, next);
        } catch { /* non-fatal */ }
      }
    })();
    return () => { cancelled = true; };
  }, [cartPriceSyncKey, updateItemPrice]);

  useEffect(() => {
    if (!token) { billingPrefilledRef.current = false; return; }
    if (billingPrefilledRef.current) return;
    let cancelled = false;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: Record<string, string | null> } | null) => {
        if (cancelled || !d?.user) return;
        billingPrefilledRef.current = true;
        const u = d.user;
        setBilling((prev) => ({
          email: (u.email as string) || prev.email,
          firstName: (u.firstName as string | null) ?? prev.firstName,
          lastName: (u.lastName as string | null) ?? prev.lastName,
          country: (u.billingCountry as string | null) || prev.country,
          city: (u.billingCity as string | null) || prev.city,
          address: (u.billingAddress as string | null) || prev.address,
          zip: (u.billingZip as string | null) || prev.zip,
          phone: (u.billingPhone as string | null) || prev.phone,
          vatNumber: (u.billingVatNumber as string | null) ?? prev.vatNumber ?? "",
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (billing.country) params.set("country", billing.country);
    if (billing.vatNumber) params.set("vatNumber", billing.vatNumber);
    fetch(`${API}/tax/lookup?${params}`).then((r) => r.json()).then((d: TaxInfo) => setTaxInfo(d)).catch(() => {});
  }, [billing.country, billing.vatNumber]);

  useEffect(() => {
    let attempts = 0;
    const load = () => {
      fetch(`${API}/checkout/config`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: CheckoutConfig | null) => {
          if (d) { setCheckoutConfig(d); setConfigLoaded(true); }
          else if (attempts < 3) { attempts++; setTimeout(load, 1500); }
          else { setConfigLoaded(true); }
        })
        .catch(() => { if (attempts < 3) { attempts++; setTimeout(load, 1500); } else { setConfigLoaded(true); } });
    };
    load();
  }, []);

  useEffect(() => {
    if (!billing.email || !billing.email.includes("@") || items.length === 0) return;
    const total = getTotal();
    const itemKey = items.map((i) => `${i.variantId}:${i.quantity}`).join(",");
    const key = `${billing.email}:${itemKey}:${total}:${coupon?.code || ""}`;
    if (capturedRef.current === key) return;
    const timer = setTimeout(() => {
      const cartItems = items.map((i) => ({ variantId: i.variantId, productId: i.productId, productName: i.productName, variantName: i.variantName, quantity: i.quantity, priceUsd: i.priceUsd, imageUrl: i.imageUrl }));
      fetch(`${API}/cart/capture`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ email: billing.email, cartData: { items: cartItems, coupon: coupon?.code }, cartTotal: total }),
      }).then(() => { capturedRef.current = key; }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [billing.email, items, coupon]);
}
