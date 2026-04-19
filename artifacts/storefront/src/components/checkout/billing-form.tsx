import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_OPTIONS } from "@/lib/country-options";

export interface BillingData {
  email: string;
  firstName: string;
  lastName: string;
  country: string;
  city: string;
  address: string;
  zip: string;
  phone: string;
  vatNumber?: string;
}

interface BillingFormProps {
  data: BillingData;
  errors: Partial<Record<keyof BillingData, string>>;
  onChange: (field: keyof BillingData, value: string) => void;
  showVatField?: boolean;
}

/** @deprecated Use COUNTRY_OPTIONS from @/lib/country-options */
export const BILLING_COUNTRIES: readonly [string, string][] = COUNTRY_OPTIONS;

function Field({
  id, label, error, children,
}: {
  id: string; label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function BillingForm({ data, errors, onChange, showVatField }: BillingFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">{t("checkout.billingDetails")}</h2>

      {/* Email — full width */}
      <Field id="email" label={`${t("checkout.email")} *`} error={errors.email}>
        <Input
          id="email" type="email" autoComplete="email"
          value={data.email} onChange={(e) => onChange("email", e.target.value)}
          className={`h-9 text-sm ${errors.email ? "border-destructive" : ""}`}
        />
      </Field>

      {/* First + Last name */}
      <div className="grid grid-cols-2 gap-3">
        <Field id="firstName" label={`${t("checkout.firstName")} *`} error={errors.firstName}>
          <Input
            id="firstName" autoComplete="given-name"
            value={data.firstName} onChange={(e) => onChange("firstName", e.target.value)}
            className={`h-9 text-sm ${errors.firstName ? "border-destructive" : ""}`}
          />
        </Field>
        <Field id="lastName" label={`${t("checkout.lastName")} *`} error={errors.lastName}>
          <Input
            id="lastName" autoComplete="family-name"
            value={data.lastName} onChange={(e) => onChange("lastName", e.target.value)}
            className={`h-9 text-sm ${errors.lastName ? "border-destructive" : ""}`}
          />
        </Field>
      </div>

      {/* Country + Phone — same row */}
      <div className="grid grid-cols-2 gap-3">
        <Field id="country" label={`${t("checkout.country")} *`} error={errors.country}>
          <Select value={data.country} onValueChange={(v) => onChange("country", v)}>
            <SelectTrigger className={`h-9 text-sm ${errors.country ? "border-destructive" : ""}`}>
              <SelectValue placeholder={t("checkout.selectCountry")} />
            </SelectTrigger>
            <SelectContent className="max-h-[min(24rem,70vh)]">
              {COUNTRY_OPTIONS.map(([code, name]) => (
                <SelectItem key={code} value={code}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="phone" label={`${t("checkout.phone")} *`} error={errors.phone}>
          <Input
            id="phone" type="tel" autoComplete="tel"
            value={data.phone} onChange={(e) => onChange("phone", e.target.value)}
            placeholder={t("checkout.phonePlaceholder")}
            className={`h-9 text-sm ${errors.phone ? "border-destructive" : ""}`}
          />
        </Field>
      </div>

      {/* Address + City + ZIP — 3 columns */}
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
        <Field id="address" label={`${t("checkout.address")} *`} error={errors.address}>
          <Input
            id="address" autoComplete="street-address"
            value={data.address} onChange={(e) => onChange("address", e.target.value)}
            className={`h-9 text-sm ${errors.address ? "border-destructive" : ""}`}
          />
        </Field>
        <Field id="city" label={`${t("checkout.city")} *`} error={errors.city}>
          <Input
            id="city" autoComplete="address-level2"
            value={data.city} onChange={(e) => onChange("city", e.target.value)}
            className={`h-9 text-sm ${errors.city ? "border-destructive" : ""}`}
          />
        </Field>
        <Field id="zip" label={`${t("checkout.zip")} *`} error={errors.zip}>
          <Input
            id="zip" autoComplete="postal-code"
            value={data.zip} onChange={(e) => onChange("zip", e.target.value)}
            className={`h-9 text-sm ${errors.zip ? "border-destructive" : ""}`}
          />
        </Field>
      </div>

      {showVatField && (
        <Field id="vatNumber" label={t("checkout.vatNumber")}>
          <Input
            id="vatNumber"
            value={data.vatNumber ?? ""} onChange={(e) => onChange("vatNumber", e.target.value)}
            placeholder="e.g. DE123456789"
            className="h-9 text-sm"
          />
        </Field>
      )}
    </div>
  );
}
