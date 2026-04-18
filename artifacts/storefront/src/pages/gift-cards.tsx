import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Gift, Send, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";

const PRESETS = [10, 25, 50, 100, 150, 200];

export default function GiftCardsPage() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(25);
  const [custom, setCustom] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [message, setMessage] = useState("");
  const addItem = useCartStore((s) => s.addItem);
  const { toast } = useToast();

  const selectedAmount = isCustom ? parseFloat(custom) || 0 : amount;

  const handleAddToCart = () => {
    if (selectedAmount < 5 || selectedAmount > 500) {
      toast({ title: t("giftCard.invalidAmount"), description: t("giftCard.amountRange"), variant: "destructive" });
      return;
    }
    if (!recipientEmail || !recipientEmail.includes("@")) {
      toast({ title: t("giftCard.emailRequired"), description: t("giftCard.emailInvalid"), variant: "destructive" });
      return;
    }

    addItem({
      variantId: -1 * Date.now(),
      productId: -1,
      productName: `Gift Card — $${selectedAmount.toFixed(2)}`,
      variantName: `To: ${recipientName || recipientEmail}`,
      imageUrl: null,
      priceUsd: selectedAmount.toFixed(2),
      platform: `GIFTCARD|${recipientEmail}|${recipientName}|${senderName}|${message}`,
    });

    toast({ title: t("giftCard.addedToCart"), description: `$${selectedAmount.toFixed(2)} — ${recipientName || recipientEmail}` });
    setRecipientEmail("");
    setRecipientName("");
    setMessage("");
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("giftCard.title") }]} />
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-2">
            <Gift className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("giftCard.title")}</h1>
          <p className="text-muted-foreground">{t("giftCard.subtitle")}</p>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-6">
          <div>
            <h3 className="font-semibold mb-3">{t("giftCard.selectAmount")}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => { setAmount(p); setIsCustom(false); }}
                  className={`rounded-lg border py-3 text-sm font-semibold transition-colors ${!isCustom && amount === p ? "bg-blue-600 text-white border-blue-600" : "bg-card hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-300"}`}>
                  ${p}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={() => setIsCustom(true)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${isCustom ? "bg-blue-600 text-white border-blue-600" : "hover:bg-blue-50"}`}>
                {t("giftCard.custom")}
              </button>
              {isCustom && (
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <input type="number" min="5" max="500" step="0.01" className="w-full rounded-md border pl-7 pr-3 py-2 text-sm"
                    value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="5.00 - 500.00" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">{t("giftCard.recipientDetails")}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`${t("giftCard.recipientEmail")} *`}>
                <input type="email" className="w-full rounded-md border px-3 py-2 text-sm" value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)} placeholder="friend@example.com" />
              </Field>
              <Field label={t("giftCard.recipientName")}>
                <input className="w-full rounded-md border px-3 py-2 text-sm" value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)} placeholder="Jane Doe" />
              </Field>
            </div>
            <Field label={t("giftCard.yourName")}>
              <input className="w-full rounded-md border px-3 py-2 text-sm" value={senderName}
                onChange={(e) => setSenderName(e.target.value)} />
            </Field>
            <Field label={t("giftCard.personalMessage")}>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y" value={message}
                onChange={(e) => setMessage(e.target.value)} maxLength={500} />
            </Field>
          </div>

          <div className="rounded-lg bg-blue-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("giftCard.total")}</p>
              <p className="text-2xl font-bold text-blue-700">${selectedAmount > 0 ? selectedAmount.toFixed(2) : "0.00"}</p>
            </div>
            <Button size="lg" onClick={handleAddToCart} disabled={selectedAmount < 5}>
              <CreditCard className="h-4 w-4 mr-2" /> {t("product.addToCart")}
            </Button>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <Send className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{t("giftCard.deliveryNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium mb-1">{label}</label>{children}</div>;
}
