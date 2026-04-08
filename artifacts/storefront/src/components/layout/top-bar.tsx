import { Headset, Globe } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { SearchAutocomplete } from "./search-autocomplete";

export function TopBar() {
  const { t } = useTranslation();
  return (
    <div className="w-full bg-background border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logo.png" alt="PixelCodes" className="h-8 w-auto" />
        </Link>

        <SearchAutocomplete />

        <div className="hidden lg:flex items-center gap-6 shrink-0 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Headset className="h-4 w-4 text-primary" />
            <span>{t("nav.support247")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            <span>{t("nav.worldwideDelivery")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
