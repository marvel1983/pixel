import { useState } from "react";
import type { BillingData } from "@/components/checkout/billing-form";
import type { CartItem, CouponData } from "@/stores/cart-store";
import type { AppliedGiftCard } from "@/components/checkout/gift-card-input";
import { validateBilling } from "@/lib/checkout-validation";
import { uuidV4 } from "@/lib/uuid";
import { hasRegionMismatch } from "@/components/cart/region-warning";
import { getAttribution } from "@/lib/attribution";
import { track, captureCartSnapshotForTrigger, suppressNextCartChange } from "@/lib/tracking";
import { fireBeginCheckout, fireAddPaymentInfo, fireLead } from "@/components/tracking/analytics";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface ProcessingFeeTier { minAmount: number; feePercent: number; feeFixed: number }
interface TaxInfo { taxRate: number; priceDisplay: string }

interface Params {
  items: CartItem[];
  billing: BillingData;
  coupon: CouponData | null;
  cppSelected: boolean;
  cppFlatPrice: number;
  feeTiers: ProcessingFeeTier[];
  feePercent: number;
  feeFixed: number;
  servicesTotal: number;
  loyaltyPoints: number;
  loyaltyDiscount: number;
  walletAmount: number;
  appliedGiftCards: AppliedGiftCard[];
  taxInfo: TaxInfo;
  paymentMethod: "card" | "invoice";
  guestPassword: string | null;
  token: string | null;
  locale: string;
  newsletterOptIn: boolean;
  regionAcknowledged: boolean;
  selectedServiceIds: number[];
  getTotal: () => number;
  clearCart: () => void;
  setBillingErrors: (errs: Record<string, string>) => void;
  setLocation: (path: string) => void;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
  t: (key: string) => string;
}

export function useCheckoutSubmit(params: Params) {
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidV4());

  function calcFee(feeBase: number) {
    const { feeTiers, feePercent, feeFixed } = params;
    if (feeTiers.length > 0) {
      const sorted = [...feeTiers].sort((a, b) => b.minAmount - a.minAmount);
      const tier = sorted.find((t) => feeBase >= t.minAmount) ?? sorted[sorted.length - 1];
      return Math.round((feeBase * tier.feePercent / 100 + tier.feeFixed) * 100) / 100;
    }
    return Math.round((feeBase * feePercent / 100 + feeFixed) * 100) / 100;
  }

  async function handleSubmit() {
    const { billing, items, coupon, cppSelected, cppFlatPrice, servicesTotal, loyaltyPoints, loyaltyDiscount,
      walletAmount, appliedGiftCards, taxInfo, paymentMethod, guestPassword, token, locale,
      newsletterOptIn, regionAcknowledged, selectedServiceIds, getTotal, clearCart,
      setBillingErrors, setLocation, toast, t } = params;

    const bResult = validateBilling(billing);
    setBillingErrors(bResult.errors as Record<string, string>);

    const hasRegionIssue = items.some((item) => {
      const ci = item as typeof item & { regionRestrictions?: string[] };
      return ci.regionRestrictions?.length && hasRegionMismatch(ci.regionRestrictions, billing.country);
    });
    if (hasRegionIssue && !regionAcknowledged) {
      track("form_validation_error", { reason: "region_mismatch_unacknowledged" });
      toast({ title: "Region mismatch", description: "Please acknowledge the region restriction warning before proceeding.", variant: "destructive" });
      return;
    }
    if (!bResult.valid) {
      track("form_validation_error", { fields: Object.keys(bResult.errors) });
      toast({ title: t("checkout.validationError") || "Please check your details", description: Object.values(bResult.errors)[0] || "Fill in all required fields.", variant: "destructive" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const subtotal = getTotal();
    const discount = coupon ? subtotal * (coupon.pct / 100) : 0;
    const cpp = cppSelected ? cppFlatPrice : 0;
    const feeBase = subtotal - discount - loyaltyDiscount + cpp + servicesTotal;
    const processingFeeAmt = calcFee(feeBase);
    const beforeTax = feeBase + processingFeeAmt;
    const isInclusive = taxInfo.priceDisplay === "inclusive";
    const taxAmount = taxInfo.taxRate > 0
      ? isInclusive ? Math.round((beforeTax - beforeTax / (1 + taxInfo.taxRate / 100)) * 100) / 100
      : Math.round(beforeTax * (taxInfo.taxRate / 100) * 100) / 100 : 0;
    const preGcTotal = isInclusive ? beforeTax : beforeTax + taxAmount;
    const gcTotal = appliedGiftCards.reduce((s, c) => s + c.applied, 0);
    const total = Math.max(0, preGcTotal - gcTotal);
    const cardTotal = Math.max(0, total - walletAmount);
    const needsCardPayment = cardTotal > 0.01 && paymentMethod === "card";

    const attribution = getAttribution();
    const sharedPayload = {
      billing, items, coupon, cppSelected, vatNumber: billing.vatNumber || undefined,
      total: total.toFixed(2), giftCards: appliedGiftCards.map((c) => ({ code: c.code, amount: c.applied })),
      loyaltyPointsUsed: loyaltyPoints || undefined, walletAmountUsd: walletAmount > 0 ? walletAmount : undefined,
      serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
      guestPassword: guestPassword || undefined, locale,
      attribution: attribution || undefined,
    };

    const subscribeNewsletter = () => {
      if (newsletterOptIn && billing.email) {
        fetch(`${API}/newsletter/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: billing.email, source: "checkout" }) }).catch(() => {});
        fireLead("newsletter");
      }
    };

    track("place_order_clicked", { paymentMethod, total: total.toFixed(2), itemCount: items.length });
    captureCartSnapshotForTrigger("place_order_clicked");
    const trackItems = items.map((i) => ({ id: i.variantId, name: i.productName, price: parseFloat(i.priceUsd), quantity: i.quantity }));
    fireBeginCheckout(total, "USD", trackItems);
    fireAddPaymentInfo(total, "USD", paymentMethod);

    setSubmitting(true);
    try {
      if (needsCardPayment) {
        const res = await fetch(`${API}/checkout/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          body: JSON.stringify({ ...sharedPayload, successUrl: `${window.location.origin}/order-complete/{ORDER_NUMBER}`, cancelUrl: `${window.location.origin}/checkout` }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 409) setIdempotencyKey(uuidV4());
          throw new Error(data.error ?? "Failed to start checkout");
        }
        track("stripe_redirect", { orderNumber: data.orderNumber });
        subscribeNewsletter();
        sessionStorage.setItem("checkout_email", billing.email);
        window.location.href = data.url as string;
      } else {
        const res = await fetch(`${API}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: "include",
          body: JSON.stringify({ ...sharedPayload, payment: { cardToken: undefined }, paymentMethod: paymentMethod === "invoice" ? "net30" : "card" }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 409) setIdempotencyKey(uuidV4());
          const detail = data.details?.fieldErrors ? Object.entries(data.details.fieldErrors as Record<string, string[]>).map(([k, v]) => `${k}: ${v[0]}`).join(", ") : null;
          throw new Error(detail ? `${data.error}: ${detail}` : (data.error ?? "Order failed"));
        }
        subscribeNewsletter();
        setIdempotencyKey(uuidV4());
        sessionStorage.setItem("checkout_email", billing.email);
        suppressNextCartChange();
        clearCart();
        setLocation(`/order-complete/${data.orderNumber}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      track(needsCardPayment ? "stripe_error" : "order_failed", { reason });
      toast({ title: t("checkout.orderFailed"), description: err instanceof Error ? err.message : t("checkout.tryAgain"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return { handleSubmit, submitting, idempotencyKey };
}
