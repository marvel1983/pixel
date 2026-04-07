import { useTranslation } from "react-i18next";
import { CreditCard, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PaymentData {
  cardNumber: string;
  expiry: string;
  cvc: string;
  cardName: string;
}

interface PaymentFormProps {
  data: PaymentData;
  errors: Partial<Record<keyof PaymentData, string>>;
  onChange: (field: keyof PaymentData, value: string) => void;
}

export function PaymentForm({ data, errors, onChange }: PaymentFormProps) {
  const { t } = useTranslation();

  function formatCardNumber(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatExpiry(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">{t("checkout.paymentDetails")}</h2>
        <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          {t("checkout.securedBy")}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3 bg-muted/5">
        <div>
          <Label htmlFor="cardName">{t("checkout.cardName")} *</Label>
          <Input
            id="cardName"
            value={data.cardName}
            onChange={(e) => onChange("cardName", e.target.value)}
            placeholder="John Doe"
            className={errors.cardName ? "border-destructive" : ""}
          />
          {errors.cardName && <p className="text-xs text-destructive mt-1">{errors.cardName}</p>}
        </div>

        <div>
          <Label htmlFor="cardNumber">{t("checkout.cardNumber")} *</Label>
          <Input
            id="cardNumber"
            value={data.cardNumber}
            onChange={(e) => onChange("cardNumber", formatCardNumber(e.target.value))}
            placeholder="4242 4242 4242 4242"
            className={errors.cardNumber ? "border-destructive" : ""}
          />
          {errors.cardNumber && <p className="text-xs text-destructive mt-1">{errors.cardNumber}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="expiry">{t("checkout.expiry")} *</Label>
            <Input
              id="expiry"
              value={data.expiry}
              onChange={(e) => onChange("expiry", formatExpiry(e.target.value))}
              placeholder="MM/YY"
              className={errors.expiry ? "border-destructive" : ""}
            />
            {errors.expiry && <p className="text-xs text-destructive mt-1">{errors.expiry}</p>}
          </div>
          <div>
            <Label htmlFor="cvc">CVC *</Label>
            <Input
              id="cvc"
              value={data.cvc}
              onChange={(e) => onChange("cvc", e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="123"
              className={errors.cvc ? "border-destructive" : ""}
            />
            {errors.cvc && <p className="text-xs text-destructive mt-1">{errors.cvc}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {["Visa", "Mastercard", "Amex", "PayPal"].map((m) => (
            <span key={m} className="text-[10px] px-2 py-0.5 rounded border bg-white text-muted-foreground font-medium">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
