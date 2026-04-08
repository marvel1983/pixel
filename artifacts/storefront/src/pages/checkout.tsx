import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { CartProgress } from "@/components/cart/cart-progress";
import { BillingForm, type BillingData } from "@/components/checkout/billing-form";
import { PaymentForm, type PaymentData } from "@/components/checkout/payment-form";
import { CppSection } from "@/components/checkout/cpp-section";
import { GuestAccount } from "@/components/checkout/guest-account";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import { ProductUpsell } from "@/components/checkout/product-upsell";
import { validateBilling, validatePayment } from "@/lib/checkout-validation";
import { getCppAmount } from "@/components/checkout/cpp-section";
import { EmptyCart } from "@/components/cart/empty-cart";
import { GiftCardInput, type AppliedGiftCard } from "@/components/checkout/gift-card-input";
import { LoyaltyRedeem } from "@/components/checkout/loyalty-redeem";
import { WalletPayment } from "@/components/checkout/wallet-payment";
import { CheckoutServices } from "@/components/checkout/checkout-services";
import { TrustpilotBadge } from "@/components/trustpilot/trustpilot-badge";
import { CheckoutRegionBlock, hasRegionMismatch } from "@/components/cart/region-warning";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

const API = import.meta.env.VITE_API_URL ?? "/api";

const INITIAL_BILLING: BillingData = {
  email: "", firstName: "", lastName: "",
  country: "", city: "", address: "", zip: "", vatNumber: "",
};

const INITIAL_PAYMENT: PaymentData = {
  cardNumber: "", expiry: "", cvc: "", cardName: "",
};

interface TaxInfo { taxRate: number; taxLabel: string; exempt: boolean; b2bEnabled: boolean; priceDisplay: string }

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    setSeoMeta({ title: t("seo.checkoutTitle"), description: t("seo.checkoutDescription") });
    return () => { clearSeoMeta(); };
  }, [t]);

  const [billing, setBilling] = useState<BillingData>(INITIAL_BILLING);
  const [billingErrors, setBillingErrors] = useState<Partial<Record<keyof BillingData, string>>>({});
  const [payment, setPayment] = useState<PaymentData>(INITIAL_PAYMENT);
  const [paymentErrors, setPaymentErrors] = useState<Partial<Record<keyof PaymentData, string>>>({});
  const [cppSelected, setCppSelected] = useState(true);
  const [guestPassword, setGuestPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taxInfo, setTaxInfo] = useState<TaxInfo>({ taxRate: 0, taxLabel: "VAT", exempt: false, b2bEnabled: false, priceDisplay: "exclusive" });
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [walletAmount, setWalletAmount] = useState(0);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [servicePrices, setServicePrices] = useState<Map<number, number>>(new Map());
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [regionAcknowledged, setRegionAcknowledged] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "invoice">("card");
  const user = useAuthStore((s) => s.user);
  const isBusinessApproved = !!user?.businessApproved;

  const capturedRef = useRef("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

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

  function handleServiceToggle(id: number, price: number) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setServicePrices((prev) => new Map(prev).set(id, price));
  }

  function handlePaymentChange(field: keyof PaymentData, value: string) {
    setPayment((prev) => ({ ...prev, [field]: value }));
    if (paymentErrors[field]) setPaymentErrors((prev) => ({ ...prev, [field]: undefined }));
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

    const subtotal = getTotal();
    const discount = coupon ? subtotal * (coupon.pct / 100) : 0;
    const cpp = cppSelected ? getCppAmount(subtotal) : 0;
    const beforeTax = subtotal - discount - loyaltyDiscount + cpp + servicesTotal;
    const isInclusive = taxInfo.priceDisplay === "inclusive";
    const taxAmount = taxInfo.taxRate > 0
      ? isInclusive
        ? Math.round((beforeTax - beforeTax / (1 + taxInfo.taxRate / 100)) * 100) / 100
        : Math.round(beforeTax * (taxInfo.taxRate / 100) * 100) / 100
      : 0;
    const preGcTotal = isInclusive ? beforeTax : beforeTax + taxAmount;
    const gcTotal = appliedGiftCards.reduce((s, c) => s + c.applied, 0);
    const total = Math.max(0, preGcTotal - gcTotal);

    const walletCoversAll = walletAmount >= total - 0.01;
    const skipCard = walletCoversAll || paymentMethod === "invoice";
    const pResult = skipCard ? { valid: true, errors: {} } : validatePayment(payment);
    setPaymentErrors(pResult.errors as Partial<Record<keyof PaymentData, string>>);
    if (!bResult.valid || !pResult.valid) return;

    setSubmitting(true);
    try {
      let cardToken: string | undefined;
      if (!skipCard) {
        const cardDigits = payment.cardNumber.replace(/\s/g, "");
        cardToken = `tok_${cardDigits.slice(-4)}_${Date.now()}`;
      }

      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
        credentials: "include",
        body: JSON.stringify({
          billing, items, coupon, cppSelected,
          vatNumber: billing.vatNumber || undefined,
          total: total.toFixed(2),
          giftCards: appliedGiftCards.map((c) => ({ code: c.code, amount: c.applied })),
          loyaltyPointsUsed: loyaltyPoints || undefined,
          walletAmountUsd: walletAmount > 0 ? walletAmount : undefined,
          serviceIds: selectedServiceIds.length > 0 ? selectedServiceIds : undefined,
          payment: { cardToken },
          paymentMethod: paymentMethod === "invoice" ? "net30" : "card",
          guestPassword: guestPassword || undefined,
          locale: i18n.language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 409) {
          setIdempotencyKey(crypto.randomUUID());
        }
        throw new Error(data.error ?? "Order failed");
      }

      if (newsletterOptIn && billing.email) {
        fetch(`${API}/newsletter/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: billing.email, source: "checkout" }),
        }).catch(() => {});
      }

      setIdempotencyKey(crypto.randomUUID());
      sessionStorage.setItem("checkout_email", billing.email);
      clearCart();
      setLocation(`/order-complete/${data.orderNumber}`);
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
          <GuestAccount onPasswordChange={setGuestPassword} />
          <Separator />
          <CppSection selected={cppSelected} onToggle={setCppSelected} subtotal={getTotal()} />
          <Separator />
          <CheckoutServices selectedIds={selectedServiceIds} onToggle={handleServiceToggle} />
          <Separator />
          <GiftCardInput
            appliedCards={appliedGiftCards}
            remainingTotal={(() => {
              const s = getTotal();
              const d = coupon ? s * (coupon.pct / 100) : 0;
              const beforeTax = s - d - loyaltyDiscount + (cppSelected ? getCppAmount(s) : 0) + servicesTotal;
              const tr = taxInfo.taxRate || 0;
              const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(beforeTax * (tr / 100) * 100) / 100;
              return Math.max(0, beforeTax + tax - appliedGiftCards.reduce((a, c) => a + c.applied, 0));
            })()}
            onApply={(c) => setAppliedGiftCards((p) => [...p, c])}
            onRemove={(code) => setAppliedGiftCards((p) => p.filter((c) => c.code !== code))}
          />
          <LoyaltyRedeem
            subtotal={getTotal()}
            onRedeemChange={(pts, disc) => { setLoyaltyPoints(pts); setLoyaltyDiscount(disc); }}
          />
          <WalletPayment orderTotal={(() => {
            const s = getTotal(); const d = coupon ? s * (coupon.pct / 100) : 0;
            const bt = s - d - loyaltyDiscount + (cppSelected ? getCppAmount(s) : 0) + servicesTotal;
            const tr = taxInfo.taxRate || 0;
            const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(bt * (tr / 100) * 100) / 100;
            return Math.max(0, bt + tax - appliedGiftCards.reduce((a, c) => a + c.applied, 0));
          })()} onWalletChange={setWalletAmount} />
          <Separator />
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
          {paymentMethod === "card" && <PaymentForm data={payment} errors={paymentErrors} onChange={handlePaymentChange} />}
          <TrustpilotBadge variant="full" />
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={newsletterOptIn} onChange={(e) => setNewsletterOptIn(e.target.checked)} />
            {t("checkout.newsletterOptIn")}
          </label>
          <Button size="lg" className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("checkout.processing")}</> : t("checkout.placeOrder")}
          </Button>
        </div>

        <div className="space-y-4">
          <CheckoutSummary cppSelected={cppSelected} taxRate={taxInfo.taxRate} taxLabel={taxInfo.taxLabel} priceDisplay={taxInfo.priceDisplay} gcDeduction={appliedGiftCards.reduce((s, c) => s + c.applied, 0)} loyaltyDiscount={loyaltyDiscount} servicesTotal={servicesTotal} />
          <ProductUpsell />
        </div>
      </div>
    </div>
  );
}
