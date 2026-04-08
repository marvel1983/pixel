import { Headset, Globe } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { SearchAutocomplete } from "./search-autocomplete";

export function TopBar() {
  const { t } = useTranslation();
  return (
    <div className="w-full bg-header-navy text-white">
      <div className="container mx-auto px-4 py-3.5 flex items-center gap-4">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logo.png" alt="PixelCodes" className="h-9 w-auto brightness-0 invert" />
        </Link>

        <SearchAutocomplete />

        <div className="hidden lg:flex items-center gap-6 shrink-0 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <Headset className="h-4 w-4 text-amber-400" />
            <span>{t("nav.support247")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-400" />
            <span>{t("nav.worldwideDelivery")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
