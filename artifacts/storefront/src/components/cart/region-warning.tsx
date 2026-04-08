import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import type { CartItem } from "@/stores/cart-store";

const COUNTRY_REGION_MAP: Record<string, string[]> = {
  US: ["NA", "GLOBAL"], CA: ["NA", "GLOBAL"], MX: ["NA", "LATAM", "GLOBAL"],
  GB: ["EU", "UK", "GLOBAL"], DE: ["EU", "GLOBAL"], FR: ["EU", "GLOBAL"], IT: ["EU", "GLOBAL"],
  ES: ["EU", "GLOBAL"], NL: ["EU", "GLOBAL"], BE: ["EU", "GLOBAL"], AT: ["EU", "GLOBAL"],
  PL: ["EU", "GLOBAL"], SE: ["EU", "GLOBAL"], DK: ["EU", "GLOBAL"], FI: ["EU", "GLOBAL"],
  PT: ["EU", "GLOBAL"], IE: ["EU", "GLOBAL"], CZ: ["EU", "GLOBAL"], RO: ["EU", "GLOBAL"],
  HU: ["EU", "GLOBAL"], GR: ["EU", "GLOBAL"], BG: ["EU", "GLOBAL"], HR: ["EU", "GLOBAL"],
  RU: ["RU", "GLOBAL"], UA: ["RU", "GLOBAL"], KZ: ["RU", "GLOBAL"], BY: ["RU", "GLOBAL"],
  JP: ["ASIA", "GLOBAL"], KR: ["ASIA", "GLOBAL"], CN: ["ASIA", "GLOBAL"],
  IN: ["ASIA", "GLOBAL"], TH: ["ASIA", "GLOBAL"], SG: ["ASIA", "GLOBAL"],
  BR: ["LATAM", "GLOBAL"], AR: ["LATAM", "GLOBAL"], CL: ["LATAM", "GLOBAL"],
  CO: ["LATAM", "GLOBAL"], PE: ["LATAM", "GLOBAL"],
  AU: ["GLOBAL"], NZ: ["GLOBAL"], ZA: ["GLOBAL"], NG: ["GLOBAL"],
};

export function getCountryRegions(countryCode: string): string[] {
  return COUNTRY_REGION_MAP[countryCode] ?? ["GLOBAL"];
}

export function detectCountryFromLocale(): string {
  try {
    const locale = navigator.language || "en-US";
    const parts = locale.split("-");
    const country = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
    if (country && country.length === 2 && COUNTRY_REGION_MAP[country]) return country;
  } catch { /* ignore */ }
  return "US";
}

export function hasRegionMismatch(itemRegions: string[], customerCountry: string): boolean {
  if (!itemRegions || itemRegions.length === 0) return false;
  const allowed = getCountryRegions(customerCountry);
  return !itemRegions.some((r) => allowed.includes(r));
}

interface CartRegionWarningProps {
  items: (CartItem & { regionRestrictions?: string[] })[];
  customerCountry: string;
}

export function CartRegionWarning({ items, customerCountry }: CartRegionWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !customerCountry) return null;

  const mismatched = items.filter((item) =>
    item.regionRestrictions && item.regionRestrictions.length > 0 && hasRegionMismatch(item.regionRestrictions, customerCountry)
  );

  if (mismatched.length === 0) return null;

  return (
    <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 rounded-lg p-3 mb-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Region Mismatch Warning</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            The following items may not be activatable in your region:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {mismatched.map((item) => (
              <li key={item.variantId} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <span className="font-medium">{item.productName}</span>
                <span className="text-amber-500">({item.regionRestrictions?.join(", ")} only)</span>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface CheckoutRegionBlockProps {
  items: (CartItem & { regionRestrictions?: string[] })[];
  customerCountry: string;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}

export function CheckoutRegionBlock({ items, customerCountry, acknowledged, onAcknowledge }: CheckoutRegionBlockProps) {
  if (!customerCountry) return null;

  const mismatched = items.filter((item) =>
    item.regionRestrictions && item.regionRestrictions.length > 0 && hasRegionMismatch(item.regionRestrictions, customerCountry)
  );

  if (mismatched.length === 0) return null;

  return (
    <div className="border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h3 className="font-semibold text-amber-800 dark:text-amber-200">Region Restriction Notice</h3>
      </div>
      <p className="text-sm text-amber-700 dark:text-amber-300">
        Some products in your cart have region restrictions that may not match your billing country.
        These keys might not activate in your region.
      </p>
      <ul className="space-y-1">
        {mismatched.map((item) => (
          <li key={item.variantId} className="text-sm flex items-center gap-2">
            <span className="font-medium">{item.productName}</span>
            <span className="text-xs text-amber-500 bg-amber-100 dark:bg-amber-900 px-1.5 py-0.5 rounded">
              {item.regionRestrictions?.join(", ")} only
            </span>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} className="rounded border-amber-400" />
        <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">
          I understand that these keys may not work in my region
        </span>
      </label>
    </div>
  );
}
