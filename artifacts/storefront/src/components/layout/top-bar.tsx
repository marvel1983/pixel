import { Headset, Globe } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { SearchAutocomplete } from "./search-autocomplete";

export function TopBar() {
  const { t } = useTranslation();
  return (
    <div className="w-full bg-white border-b border-border">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PC</span>
          </div>
          <span className="text-xl font-bold text-foreground hidden sm:block">
            PixelCodes
          </span>
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
