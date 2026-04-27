import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { EmptyCart } from "@/components/cart/empty-cart";
import { GiftCardInput, type AppliedGiftCard } from "@/components/checkout/gift-card-input";
import { LoyaltyRedeem } from "@/components/checkout/loyalty-redeem";
import { WalletPayment } from "@/components/checkout/wallet-payment";
import { CheckoutServices } from "@/components/checkout/checkout-services";
import { TrustpilotBadge } from "@/components/trustpilot/trustpilot-badge";
import { CheckoutRegionBlock } from "@/components/cart/region-warning";
import { CardPaymentSection } from "@/components/checkout/payment-icons";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { useCheckoutSetup } from "@/hooks/use-checkout-setup";
import { useCheckoutSubmit } from "@/hooks/use-checkout-submit";

const API = import.meta.env.VITE_API_URL ?? "/api";

const INITIAL_BILLING: BillingData = { email: "", firstName: "", lastName: "", country: "", city: "", address: "", zip: "", phone: "", vatNumber: "" };

interface TaxInfo { taxRate: number; taxLabel: string; exempt: boolean; b2bEnabled: boolean; priceDisplay: string }
interface ProcessingFeeTier { minAmount: number; feePercent: number; feeFixed: number }
interface CheckoutConfig { cppEnabled: boolean; cppLabel: string; cppPrice: string; cppDescription: string; processingFeePercent: string; processingFeeFixed: string; processingFeeTiers: ProcessingFeeTier[] }

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
  const [checkoutConfig, setCheckoutConfig] = useState<CheckoutConfig>({ cppEnabled: false, cppLabel: "Checkout Protection Plan", cppPrice: "0.99", cppDescription: "", processingFeePercent: "0", processingFeeFixed: "0", processingFeeTiers: [] });
  const [configLoaded, setConfigLoaded] = useState(false);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  useCheckoutSetup({ items, billing, token, coupon, updateItemPrice, setBilling, setTaxInfo, setCheckoutConfig, setConfigLoaded, getTotal });

  const cppFlatPrice = Number(checkoutConfig.cppPrice) || 0;
  const feePercent = Number(checkoutConfig.processingFeePercent) || 0;
  const feeFixed = Number(checkoutConfig.processingFeeFixed) || 0;
  const feeTiers = checkoutConfig.processingFeeTiers ?? [];
  const servicesTotal = Array.from(servicePrices.entries()).filter(([id]) => selectedServiceIds.includes(id)).reduce((s, [, p]) => s + p, 0);

  function calcProcessingFee(feeBase: number) {
    if (feeTiers.length > 0) {
      const sorted = [...feeTiers].sort((a, b) => b.minAmount - a.minAmount);
      const tier = sorted.find((t) => feeBase >= t.minAmount) ?? sorted[sorted.length - 1];
      return Math.round((feeBase * tier.feePercent / 100 + tier.feeFixed) * 100) / 100;
    }
    return Math.round((feeBase * feePercent / 100 + feeFixed) * 100) / 100;
  }

  function handleServiceToggle(id: number, price: number) {
    setSelectedServiceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    setServicePrices((prev) => new Map(prev).set(id, price));
  }

  const { handleSubmit, submitting } = useCheckoutSubmit({
    items, billing, coupon, cppSelected, cppFlatPrice, feeTiers, feePercent, feeFixed,
    servicesTotal, loyaltyPoints, loyaltyDiscount, walletAmount, appliedGiftCards,
    taxInfo, paymentMethod, guestPassword, token, locale: i18n.language,
    newsletterOptIn, regionAcknowledged, selectedServiceIds, getTotal, clearCart,
    setBillingErrors: (errs) => setBillingErrors(errs as Partial<Record<keyof BillingData, string>>),
    setLocation, toast, t,
  });

  if (items.length === 0) return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]} />
      <CartProgress step={2} /><EmptyCart />
    </div>
  );

  function handleBillingChange(field: keyof BillingData, value: string) {
    setBilling((prev) => ({ ...prev, [field]: value }));
    if (billingErrors[field]) setBillingErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const gcDeduction = appliedGiftCards.reduce((s, c) => s + c.applied, 0);
  const feeBaseForSummary = getTotal() - (coupon ? getTotal() * (coupon.pct / 100) : 0) - loyaltyDiscount + (cppSelected ? cppFlatPrice : 0) + servicesTotal;
  const remainingForGc = (() => {
    const base = getTotal() - (coupon ? getTotal() * (coupon.pct / 100) : 0) - loyaltyDiscount + (cppSelected ? cppFlatPrice : 0) + servicesTotal;
    const pf = calcProcessingFee(base);
    const bt = base + pf;
    const tr = taxInfo.taxRate || 0;
    const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(bt * (tr / 100) * 100) / 100;
    return Math.max(0, bt + tax - gcDeduction);
  })();

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("cart.title"), href: "/cart" }, { label: t("checkout.title") }]} />
      <CartProgress step={2} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <BillingForm data={billing} errors={billingErrors} onChange={handleBillingChange} showVatField={taxInfo.b2bEnabled} />
          <CheckoutRegionBlock items={items} customerCountry={billing.country} acknowledged={regionAcknowledged} onAcknowledge={setRegionAcknowledged} />
          {!token && <GuestAccount onPasswordChange={setGuestPassword} />}
          {checkoutConfig.cppEnabled && <CppSection selected={cppSelected} onToggle={setCppSelected} cppPrice={cppFlatPrice} cppLabel={checkoutConfig.cppLabel} cppDescription={checkoutConfig.cppDescription} />}
          <CheckoutServices selectedIds={selectedServiceIds} onToggle={handleServiceToggle} />
          <ProductUpsell />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <GiftCardInput appliedCards={appliedGiftCards} remainingTotal={remainingForGc} onApply={(c) => setAppliedGiftCards((p) => [...p, c])} onRemove={(code) => setAppliedGiftCards((p) => p.filter((c) => c.code !== code))} />
            {paymentMethod === "card" && <CardPaymentSection />}
            <LoyaltyRedeem subtotal={getTotal()} onRedeemChange={(pts, disc) => { setLoyaltyPoints(pts); setLoyaltyDiscount(disc); }} />
            <WalletPayment orderTotal={(() => {
              const base = getTotal() - (coupon ? getTotal() * (coupon.pct / 100) : 0) - loyaltyDiscount + (cppSelected ? cppFlatPrice : 0) + servicesTotal;
              const pf = calcProcessingFee(base); const bt = base + pf; const tr = taxInfo.taxRate || 0;
              const tax = taxInfo.priceDisplay === "inclusive" ? 0 : Math.round(bt * (tr / 100) * 100) / 100;
              return Math.max(0, bt + tax - gcDeduction);
            })()} onWalletChange={setWalletAmount} />
          </div>
          {!!user?.businessApproved && (
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
            <Lock className="h-3.5 w-3.5 text-emerald-500" /><span>Secure &amp; encrypted checkout</span><Shield className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <Button size="lg" className="w-full max-w-sm mx-auto block" disabled={submitting || !configLoaded} onClick={handleSubmit}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("checkout.processing")}</>
              : !configLoaded ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</>
              : paymentMethod === "card" && walletAmount < getTotal() ? "Continue to Payment →"
              : t("checkout.placeOrder")}
          </Button>
        </div>
        <div className="min-w-0 space-y-4 rounded-lg bg-background lg:sticky lg:top-24 lg:z-10 lg:self-start lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1">
          <CheckoutSummary cppSelected={cppSelected} cppPrice={cppFlatPrice} taxRate={taxInfo.taxRate} taxLabel={taxInfo.taxLabel} priceDisplay={taxInfo.priceDisplay} gcDeduction={gcDeduction} loyaltyDiscount={loyaltyDiscount} servicesTotal={servicesTotal}
            processingFee={calcProcessingFee(feeBaseForSummary)}
            processingFeeLabel={(() => {
              if (feeTiers.length > 0) return "Processing fee";
              if (feePercent > 0 && feeFixed > 0) return `Processing fee (${feePercent}% + €${feeFixed.toFixed(2)})`;
              if (feePercent > 0) return `Processing fee (${feePercent}%)`;
              if (feeFixed > 0) return `Processing fee (€${feeFixed.toFixed(2)})`;
              return undefined;
            })()}
          />
        </div>
      </div>
    </div>
  );
}
