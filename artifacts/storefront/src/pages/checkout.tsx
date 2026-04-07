import { useState } from "react";
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

const INITIAL_BILLING: BillingData = {
  email: "", firstName: "", lastName: "",
  country: "", city: "", address: "", zip: "",
};

const INITIAL_PAYMENT: PaymentData = {
  cardNumber: "", expiry: "", cvc: "", cardName: "",
};

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
      const total = subtotal - discount + cpp;

      const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
      const res = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing, items, coupon, cppSelected,
          total: total.toFixed(2),
          guestPassword: guestPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Order failed");

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
          <BillingForm data={billing} errors={billingErrors} onChange={handleBillingChange} />
          <Separator />
          <GuestAccount onPasswordChange={setGuestPassword} />
          <Separator />
          <CppSection selected={cppSelected} onToggle={setCppSelected} subtotal={getTotal()} />
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
          <CheckoutSummary cppSelected={cppSelected} />
          <ProductUpsell />
        </div>
      </div>
    </div>
  );
}
