import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BILLING_COUNTRIES } from "@/components/checkout/billing-form";

interface Props {
  country: string;
  city: string;
  zip: string;
  address: string;
  vatNumber: string;
  phone: string;
  update: (field: string, value: string) => void;
}

export function ProfileBillingAddress({ country, city, zip, address, vatNumber, phone, update }: Props) {
  const { t } = useTranslation();
  return (
    <div className="border-t pt-4 mt-4 space-y-4">
      <div>
        <p className="text-sm font-medium">{t("accountPage.billingAddressTitle")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("accountPage.billingAddressHint")}</p>
      </div>
      <div>
        <Label htmlFor="profile-country">{t("checkout.country")}</Label>
        <Select value={country || undefined} onValueChange={(v) => update("billingCountry", v)}>
          <SelectTrigger id="profile-country" className="w-full">
            <SelectValue placeholder={t("checkout.selectCountry")} />
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,70vh)]">
            {BILLING_COUNTRIES.map(([code, name]) => (
              <SelectItem key={code} value={code}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="profile-city">{t("checkout.city")}</Label>
          <Input id="profile-city" value={city} onChange={(e) => update("billingCity", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="profile-zip">{t("checkout.zip")}</Label>
          <Input id="profile-zip" value={zip} onChange={(e) => update("billingZip", e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="profile-address">{t("checkout.address")}</Label>
        <Input id="profile-address" value={address} onChange={(e) => update("billingAddress", e.target.value)} />
      </div>
      <div>
        <Label htmlFor="profile-vat">{t("checkout.vatNumber")}</Label>
        <Input id="profile-vat" value={vatNumber} onChange={(e) => update("billingVatNumber", e.target.value)} placeholder={t("accountPage.billingVatOptional")} />
      </div>
      <div>
        <Label htmlFor="profile-phone">{t("checkout.phone")}</Label>
        <Input id="profile-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => update("billingPhone", e.target.value)} placeholder={t("checkout.phonePlaceholder")} />
      </div>
    </div>
  );
}
