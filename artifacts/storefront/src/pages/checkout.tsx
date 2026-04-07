import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCartStore } from "@/stores/cart-store";
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
  const items = useCartStore((s) => s.items);
  const coupon = useCartStore((s) => s.coupon);
  const getTotal = useCartStore((s) => s.getTotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [billing, setBilling] = useState<BillingData>(INITIAL_BILLING);
  const [billingErrors, setBillingErrors] = useState<Partial<Record<keyof BillingData, string>>>({});
  const [payment, setPayment] = useState<PaymentData>(INITIAL_PAYMENT);
  const [paymentErrors, setPaymentErrors] = useState<Partial<Record<keyof PaymentData, string>>>({});
  const [cppSelected, setCppSelected] = useState(true);
  const [guestPassword, setGuestPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [taxInfo, setTaxInfo] = useState<TaxInfo>({ taxRate: 0, taxLabel: "VAT", exempt: false, b2bEnabled: false, priceDisplay: "exclusive" });
  const [appliedGiftCards, setAppliedGiftCards] = useState<AppliedGiftCard[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (billing.country) params.set("country", billing.country);
    if (billing.vatNumber) params.set("vatNumber", billing.vatNumber);
    fetch(`${API}/tax/lookup?${params}`)
      .then((r) => r.json())
      .then((d: TaxInfo) => setTaxInfo(d))
      .catch(() => {});
  }, [billing.country, billing.vatNumber]);

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Breadcrumbs crumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
        <CartProgress step={2} />
        <EmptyCart />
      </div>
    );
  }

  function handleBillingChange(field: keyof BillingData, value: string) {
    setBilling((prev) => ({ ...prev, [field]: value }));
    if (billingErrors[field]) setBillingErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handlePaymentChange(field: keyof PaymentData, value: string) {
    setPayment((prev) => ({ ...prev, [field]: value }));
    if (paymentErrors[field]) setPaymentErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit() {
    const bResult = validateBilling(billing);
    const pResult = validatePayment(payment);
    setBillingErrors(bResult.errors);
    setPaymentErrors(pResult.errors);
    if (!bResult.valid || !pResult.valid) return;

    setSubmitting(true);
    try {
      const subtotal = getTotal();
      const discount = coupon ? subtotal * (coupon.pct / 100) : 0;
      const cpp = cppSelected ? getCppAmount(subtotal) : 0;
      const beforeTax = subtotal - discount + cpp;
      const isInclusive = taxInfo.priceDisplay === "inclusive";
      const taxAmount = taxInfo.taxRate > 0
        ? isInclusive
          ? Math.round((beforeTax - beforeTax / (1 + taxInfo.taxRate / 100)) * 100) / 100
          : Math.round(beforeTax * (taxInfo.taxRate / 100) * 100) / 100
        : 0;
      const preGcTotal = isInclusive ? beforeTax : beforeTax + taxAmount;
      const gcTotal = appliedGiftCards.reduce((s, c) => s + c.applied, 0);
      const total = Math.max(0, preGcTotal - gcTotal);

      const cardDigits = payment.cardNumber.replace(/\s/g, "");
      const cardToken = `tok_${cardDigits.slice(-4)}_${Date.now()}`;

      const res = await fetch(`${API}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing, items, coupon, cppSelected,
          vatNumber: billing.vatNumber || undefined,
          total: total.toFixed(2),
          giftCards: appliedGiftCards.map((c) => ({ code: c.code, amount: c.applied })),
          payment: { cardToken },
          guestPassword: guestPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Order failed");

      sessionStorage.setItem("checkout_email", billing.email);
      clearCart();
      setLocation(`/order-complete/${data.orderNumber}`);
    } catch (err) {
      toast({
        title: "Order failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      <CartProgress step={2} />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <BillingForm data={billing} errors={billingErrors} onChange={handleBillingChange} showVatField={taxInfo.b2bEnabled} />
          <Separator />
          <GuestAccount onPasswordChange={setGuestPassword} />
          <Separator />
          <CppSection selected={cppSelected} onToggle={setCppSelected} subtotal={getTotal()} />
          <Separator />
          <GiftCardInput
            appliedCards={appliedGiftCards}
            remainingTotal={(() => {
              const s = getTotal();
              const d = coupon ? s * (coupon.pct / 100) : 0;
              const beforeTax = s - d + (cppSelected ? getCppAmount(s) : 0);
              const tr = taxInfo.taxRate || 0;
              const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(beforeTax * (tr / 100) * 100) / 100;
              return Math.max(0, beforeTax + tax - appliedGiftCards.reduce((a, c) => a + c.applied, 0));
            })()}
            onApply={(c) => setAppliedGiftCards((p) => [...p, c])}
            onRemove={(code) => setAppliedGiftCards((p) => p.filter((c) => c.code !== code))}
          />
          <Separator />
          <PaymentForm data={payment} errors={paymentErrors} onChange={handlePaymentChange} />
          <Button size="lg" className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
            ) : (
              "Place Order"
            )}
          </Button>
        </div>

        <div className="space-y-4">
          <CheckoutSummary cppSelected={cppSelected} taxRate={taxInfo.taxRate} taxLabel={taxInfo.taxLabel} priceDisplay={taxInfo.priceDisplay} gcDeduction={appliedGiftCards.reduce((s, c) => s + c.applied, 0)} />
          <ProductUpsell />
        </div>
      </div>
    </div>
  );
}
