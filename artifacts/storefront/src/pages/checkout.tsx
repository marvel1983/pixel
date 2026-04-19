import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CartProgress } from "@/components/cart/cart-progress";
import { BillingForm, type BillingData } from "@/components/checkout/billing-form";
import { CppSection } from "@/components/checkout/cpp-section";
import { GuestAccount } from "@/components/checkout/guest-account";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import { ProductUpsell } from "@/components/checkout/product-upsell";
import { validateBilling } from "@/lib/checkout-validation";
import { EmptyCart } from "@/components/cart/empty-cart";
import { GiftCardInput, type AppliedGiftCard } from "@/components/checkout/gift-card-input";
import { LoyaltyRedeem } from "@/components/checkout/loyalty-redeem";
import { WalletPayment } from "@/components/checkout/wallet-payment";
import { CheckoutServices } from "@/components/checkout/checkout-services";
import { TrustpilotBadge } from "@/components/trustpilot/trustpilot-badge";
import { CheckoutRegionBlock, hasRegionMismatch } from "@/components/cart/region-warning";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { uuidV4 } from "@/lib/uuid";

const API = import.meta.env.VITE_API_URL ?? "/api";

/* ─── Payment method SVG icons ────────────────────────── */
function CardPaymentIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden="true">
      {/* card body */}
      <rect x="4" y="10" width="40" height="28" rx="5" fill="#3b82f6" opacity="0.15" />
      <rect x="4" y="10" width="40" height="28" rx="5" stroke="#3b82f6" strokeWidth="2.2" />
      {/* magnetic stripe */}
      <rect x="4" y="17" width="40" height="7" fill="#3b82f6" opacity="0.25" />
      {/* chip */}
      <rect x="10" y="27" width="9" height="7" rx="2" fill="#3b82f6" opacity="0.4" stroke="#3b82f6" strokeWidth="1.5" />
      <line x1="14.5" y1="27" x2="14.5" y2="34" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
      <line x1="10" y1="30.5" x2="19" y2="30.5" stroke="#3b82f6" strokeWidth="1" opacity="0.6" />
      {/* card numbers (dots) */}
      {[25, 30, 35].map((x) => (
        <circle key={x} cx={x} cy="31" r="1.5" fill="#3b82f6" opacity="0.5" />
      ))}
      {/* contactless waves */}
      <path d="M32 26 a6 6 0 0 1 0 6" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <path d="M35 23 a10 10 0 0 1 0 12" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
      {/* lock badge */}
      <circle cx="40" cy="12" r="5" fill="#0a1e3d" />
      <rect x="38" y="12" width="4" height="3.5" rx="0.8" fill="#3b82f6" />
      <path d="M38.5 12v-1.2a1.5 1.5 0 0 1 3 0V12" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function VisaIcon() {
  return (
    <div className="bg-white rounded px-1.5 py-0.5 flex items-center">
      <svg viewBox="0 0 38 12" fill="none" className="h-3 w-auto">
        <text x="0" y="10" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#1434CB">VISA</text>
      </svg>
    </div>
  );
}

function MastercardIcon() {
  return (
    <div className="flex items-center gap-0">
      <div className="w-5 h-5 rounded-full bg-red-500 opacity-90" style={{ marginRight: -6 }} />
      <div className="w-5 h-5 rounded-full bg-amber-400 opacity-90" />
    </div>
  );
}

function AmexIcon() {
  return (
    <div className="bg-blue-500 rounded px-1.5 py-0.5 flex items-center">
      <svg viewBox="0 0 40 12" fill="none" className="h-3 w-auto">
        <text x="0" y="10" fontFamily="Arial" fontWeight="bold" fontSize="9" fill="white" letterSpacing="0.5">AMEX</text>
      </svg>
    </div>
  );
}

const INITIAL_BILLING: BillingData = {
  email: "", firstName: "", lastName: "",
  country: "", city: "", address: "", zip: "", phone: "", vatNumber: "",
};

interface TaxInfo { taxRate: number; taxLabel: string; exempt: boolean; b2bEnabled: boolean; priceDisplay: string }
interface CheckoutConfig { cppEnabled: boolean; cppLabel: string; cppPrice: string; cppDescription: string; processingFeePercent: string; processingFeeFixed: string; }

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const updateItemPrice = useCartStore((s) => s.updateItemPrice);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setSeoMeta({ title: t("seo.checkoutTitle"), description: t("seo.checkoutDescription") });
    return () => { clearSeoMeta(); };
  }, [t]);

  const [billing, setBilling] = useState<BillingData>(INITIAL_BILLING);
  const [billingErrors, setBillingErrors] = useState<Partial<Record<keyof BillingData, string>>>({});
  const [cppSelected, setCppSelected] = useState(false);
  const [guestPassword, setGuestPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taxInfo, setTaxInfo] = useState<TaxInfo>({ taxRate: 0, taxLabel: "VAT", exempt: false, b2bEnabled: false, priceDisplay: "exclusive" });
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [servicePrices, setServicePrices] = useState<Map<number, number>>(new Map());
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [regionAcknowledged, setRegionAcknowledged] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "invoice">("card");
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig>({ cppEnabled: false, cppLabel: "Checkout Protection Plan", cppPrice: "0.99", cppDescription: "", processingFeePercent: "0", processingFeeFixed: "0" });
  const [configLoaded, setConfigLoaded] = useState(false);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isBusinessApproved = !!user?.businessApproved;

  const capturedRef = useRef("");
  const billingPrefilledRef = useRef(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidV4());

  /** Lines up cart line prices with the same engine used by POST /orders (rules, override, bulk, flash). */
  const cartPriceSyncKey = useMemo(
    () =>
      items
        .filter((i) => !i.bundleId && i.variantId > 0)
        .map((i) => `${i.variantId}:${i.quantity}`)
        .sort()
        .join("|"),
    [items],
  );

  useEffect(() => {
    if (!cartPriceSyncKey) return;
    let cancelled = false;
    (async () => {
      const lines = useCartStore.getState().items.filter((i) => !i.bundleId && i.variantId > 0);
      for (const item of lines) {
        try {
          const r = await fetch(`${API}/variants/${item.variantId}/price?qty=${item.quantity}`);
          if (!r.ok || cancelled) continue;
          const d = (await r.json()) as { price?: { effectiveUnitPriceUsd?: string } };
          const next = d?.price?.effectiveUnitPriceUsd;
          if (next) updateItemPrice(item.variantId, next);
        } catch {
          /* non-fatal */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cartPriceSyncKey, updateItemPrice]);

  useEffect(() => {
    if (!token) {
      billingPrefilledRef.current = false;
      return;
    }
    if (billingPrefilledRef.current) return;

    let cancelled = false;
    fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    })
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

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (billing.country) params.set("country", billing.country);
    if (billing.vatNumber) params.set("vatNumber", billing.vatNumber);
    fetch(`${API}/tax/lookup?${params}`)
      .then((r) => r.json())
      .then((d: TaxInfo) => setTaxInfo(d))
      .catch(() => {});
  }, [billing.country, billing.vatNumber]);

  useEffect(() => {
    fetch(`${API}/checkout/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: CheckoutConfig | null) => { if (d) setCheckoutConfig(d); })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: billing.email, cartData: { items: cartItems, coupon: coupon?.code }, cartTotal: total }),
      }).then(() => { capturedRef.current = key; }).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [billing.email, items, coupon]);

  if (items.length === 0) return (<div className="container mx-auto px-4 py-6"><Breadcrumbs crumbs={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]} /><CartProgress step={2} /><EmptyCart /></div>);

  function handleBillingChange(field: keyof BillingData, value: string) {
    setBilling((prev) => ({ ...prev, [field]: value }));
    if (billingErrors[field]) setBillingErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const servicesTotal = Array.from(servicePrices.entries())
    .filter(([id]) => selectedServiceIds.includes(id))
    .reduce((s, [, p]) => s + p, 0);

  const cppFlatPrice = Number(checkoutConfig.cppPrice) || 0;
  const feePercent = Number(checkoutConfig.processingFeePercent) || 0;
  const feeFixed = Number(checkoutConfig.processingFeeFixed) || 0;
  function calcProcessingFee(feeBase: number) {
    return Math.round((feeBase * feePercent / 100 + feeFixed) * 100) / 100;
  }

  function handleServiceToggle(id: number, price: number) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setServicePrices((prev) => new Map(prev).set(id, price));
  }

  async function handleSubmit() {
    const bResult = validateBilling(billing);
    setBillingErrors(bResult.errors);

    const hasRegionIssue = items.some((item) => {
      const cartItem = item as typeof item & { regionRestrictions?: string[] };
      return cartItem.regionRestrictions?.length && hasRegionMismatch(cartItem.regionRestrictions, billing.country);
    });
    if (hasRegionIssue && !regionAcknowledged) {
      toast({ title: "Region mismatch", description: "Please acknowledge the region restriction warning before proceeding.", variant: "destructive" });
      return;
    }

    if (!bResult.valid) {
      toast({
        title: t("checkout.validationError") || "Please check your details",
        description: Object.values(bResult.errors)[0] || "Fill in all required fields before placing the order.",
        variant: "destructive",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const subtotal = getTotal();
    const discount = coupon ? subtotal * (coupon.pct / 100) : 0;
    const cpp = cppSelected ? cppFlatPrice : 0;
    const feeBase = subtotal - discount - loyaltyDiscount + cpp + servicesTotal;
    const processingFeeAmt = calcProcessingFee(feeBase);
    const beforeTax = feeBase + processingFeeAmt;
    const isInclusive = taxInfo.priceDisplay === "inclusive";
    const taxAmount = taxInfo.taxRate > 0
      ? isInclusive
        ? Math.round((beforeTax - beforeTax / (1 + taxInfo.taxRate / 100)) * 100) / 100
        : Math.round(beforeTax * (taxInfo.taxRate / 100) * 100) / 100
      : 0;
    const preGcTotal = isInclusive ? beforeTax : beforeTax + taxAmount;
    const gcTotal = appliedGiftCards.reduce((s, c) => s + c.applied, 0);
    const total = Math.max(0, preGcTotal - gcTotal);
    const cardTotal = Math.max(0, total - walletAmount);

    // Card payment → hosted checkout page (Stripe or Checkout.com depending on active provider)
    const needsCardPayment = cardTotal > 0.01 && paymentMethod === "card";

    const sharedPayload = {
      billing, items, coupon, cppSelected,
      vatNumber: billing.vatNumber || undefined,
      total: total.toFixed(2),
      giftCards: appliedGiftCards.map((c) => ({ code: c.code, amount: c.applied })),
      loyaltyPointsUsed: loyaltyPoints || undefined,
      walletAmountUsd: walletAmount > 0 ? walletAmount : undefined,
      serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
      guestPassword: guestPassword || undefined,
      locale: i18n.language,
    };

    setSubmitting(true);
    try {
      if (needsCardPayment) {
        // Redirect to Stripe Checkout
        const res = await fetch(`${API}/checkout/session`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            ...sharedPayload,
            successUrl: `${window.location.origin}/order-complete/{ORDER_NUMBER}`,
            cancelUrl: `${window.location.origin}/checkout`,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 409) setIdempotencyKey(uuidV4());
          throw new Error(data.error ?? "Failed to start checkout");
        }

        if (newsletterOptIn && billing.email) {
          fetch(`${API}/newsletter/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: billing.email, source: "checkout" }),
          }).catch(() => {});
        }

        // Persist email for order-complete page; redirect without clearing cart
        // (cart is cleared on order-complete after successful fulfillment)
        sessionStorage.setItem("checkout_email", billing.email);
        window.location.href = data.url as string;
      } else {
        // Wallet-only or Net30: existing synchronous flow
        const res = await fetch(`${API}/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKey,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            ...sharedPayload,
            payment: { cardToken: undefined },
            paymentMethod: paymentMethod === "invoice" ? "net30" : "card",
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status >= 400 && res.status < 500 && res.status !== 409) setIdempotencyKey(uuidV4());
          const detail = data.details?.fieldErrors
            ? Object.entries(data.details.fieldErrors as Record<string, string[]>).map(([k, v]) => `${k}: ${v[0]}`).join(", ")
            : null;
          throw new Error(detail ? `${data.error}: ${detail}` : (data.error ?? "Order failed"));
        }

        if (newsletterOptIn && billing.email) {
          fetch(`${API}/newsletter/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: billing.email, source: "checkout" }),
          }).catch(() => {});
        }

        setIdempotencyKey(uuidV4());
        sessionStorage.setItem("checkout_email", billing.email);
        clearCart();
        setLocation(`/order-complete/${data.orderNumber}`);
      }
    } catch (err) {
      toast({
        title: t("checkout.orderFailed"),
        description: err instanceof Error ? err.message : t("checkout.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]} />
      <CartProgress step={2} />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <BillingForm data={billing} errors={billingErrors} onChange={handleBillingChange} showVatField={taxInfo.b2bEnabled} />
          <CheckoutRegionBlock items={items} customerCountry={billing.country} acknowledged={regionAcknowledged} onAcknowledge={setRegionAcknowledged} />
          <Separator />
          {!token && <><GuestAccount onPasswordChange={setGuestPassword} /><Separator /></>}
          {checkoutConfig.cppEnabled && (
            <CppSection selected={cppSelected} onToggle={setCppSelected} cppPrice={cppFlatPrice} cppLabel={checkoutConfig.cppLabel} cppDescription={checkoutConfig.cppDescription} />
          )}
          <Separator />
          <CheckoutServices selectedIds={selectedServiceIds} onToggle={handleServiceToggle} />
          <Separator />
          {/* ─── Upsell offers ─────────────────────────────── */}
          <ProductUpsell />
          {/* ─── Gift card / Loyalty / Wallet / Card payment ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <GiftCardInput
              appliedCards={appliedGiftCards}
              remainingTotal={(() => {
                const s = getTotal();
                const d = coupon ? s * (coupon.pct / 100) : 0;
                const base = s - d - loyaltyDiscount + (cppSelected ? cppFlatPrice : 0) + servicesTotal;
                const pf = calcProcessingFee(base);
                const beforeTax = base + pf;
                const tr = taxInfo.taxRate || 0;
                const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(beforeTax * (tr / 100) * 100) / 100;
                return Math.max(0, beforeTax + tax - appliedGiftCards.reduce((a, c) => a + c.applied, 0));
              })()}
              onApply={(c) => setAppliedGiftCards((p) => [...p, c])}
              onRemove={(code) => setAppliedGiftCards((p) => p.filter((c) => c.code !== code))}
            />
            {/* Card payment */}
            {paymentMethod === "card" && (
              <div
                className="relative rounded-xl overflow-hidden border"
                style={{
                  background: "linear-gradient(135deg, #0a1e3d 0%, #0d2a54 60%, #0a1e3d 100%)",
                  borderColor: "#ffffff15",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(ellipse 70% 50% at 80% 50%, #3b82f615, transparent)" }}
                />
                <div className="relative p-4 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 shrink-0">
                      <CardPaymentIcon />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">Secure Card Payment</p>
                      <p className="text-[11px] text-white/50 mt-0.5 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> via Stripe
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-white/55 mb-3 leading-relaxed">
                    Redirected to Stripe's encrypted payment page. Your card details are never stored on our servers.
                  </p>
                  <div className="flex items-center gap-2 mt-auto">
                    <VisaIcon />
                    <MastercardIcon />
                    <AmexIcon />
                  </div>
                </div>
              </div>
            )}
            <LoyaltyRedeem
              subtotal={getTotal()}
              onRedeemChange={(pts, disc) => { setLoyaltyPoints(pts); setLoyaltyDiscount(disc); }}
            />
            <WalletPayment orderTotal={(() => {
              const s = getTotal(); const d = coupon ? s * (coupon.pct / 100) : 0;
              const base = s - d - loyaltyDiscount + (cppSelected ? cppFlatPrice : 0) + servicesTotal;
              const pf = calcProcessingFee(base);
              const bt = base + pf;
              const tr = taxInfo.taxRate || 0;
              const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(bt * (tr / 100) * 100) / 100;
              return Math.max(0, bt + tax - appliedGiftCards.reduce((a, c) => a + c.applied, 0));
            })()} onWalletChange={setWalletAmount} />
          </div>

          {/* B2B invoice toggle */}
          {isBusinessApproved && (
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold">Payment Method</p>
              <div className="flex gap-3">
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer text-center text-sm transition-colors ${paymentMethod === "card" ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name="payMethod" className="sr-only" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                  <span className="font-medium">Credit Card</span>
                </label>
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer text-center text-sm transition-colors ${paymentMethod === "invoice" ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name="payMethod" className="sr-only" checked={paymentMethod === "invoice"} onChange={() => setPaymentMethod("invoice")} />
                  <span className="font-medium">Invoice (Net 30)</span>
                </label>
              </div>
              {paymentMethod === "invoice" && <p className="text-xs text-muted-foreground">Payment due within 30 days. An invoice will be sent to your billing email.</p>}
            </div>
          )}
          <TrustpilotBadge variant="full" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} />
            {t("checkout.newsletterOptIn")}
          </label>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
            <Lock className="h-3.5 w-3.5 text-emerald-500" />
            <span>Secure & encrypted checkout</span>
            <Shield className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <Button size="lg" className="w-full max-w-sm mx-auto block" disabled={submitting || !configLoaded} onClick={handleSubmit}>
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("checkout.processing")}</>
              : !configLoaded
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
                : paymentMethod === "card" && walletAmount < (getTotal())
                  ? "Continue to Payment →"
                  : t("checkout.placeOrder")}
          </Button>
        </div>

        <div className="min-w-0 space-y-4 rounded-lg bg-background lg:sticky lg:top-24 lg:z-10 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1">
          <CheckoutSummary
            cppSelected={cppSelected}
            cppPrice={cppFlatPrice}
            taxRate={taxInfo.taxRate}
            taxLabel={taxInfo.taxLabel}
            priceDisplay={taxInfo.priceDisplay}
            gcDeduction={appliedGiftCards.reduce((s, c) => s + c.applied, 0)}
            loyaltyDiscount={loyaltyDiscount}
            servicesTotal={servicesTotal}
            processingFee={calcProcessingFee(
              getTotal() - (coupon ? getTotal() * (coupon.pct / 100) : 0) - loyaltyDiscount + (cppSelected ? cppFlatPrice : 0) + servicesTotal
            )}
            processingFeeLabel={feePercent > 0 && feeFixed > 0 ? `Processing fee (${feePercent}% + €${feeFixed.toFixed(2)})` : feePercent > 0 ? `Processing fee (${feePercent}%)` : feeFixed > 0 ? `Processing fee (€${feeFixed.toFixed(2)})` : undefined}
          />
        </div>
      </div>
    </div>
  );
}
