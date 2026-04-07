import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface LocaleOption {
  code: string;
  name: string;
  flag: string;
}

const DEFAULT_LOCALES: LocaleOption[] = SUPPORTED_LOCALES.map((l) => ({
  code: l.code,
  name: l.name,
  flag: l.flag,
}));

interface LocalesResponse {
  locales: LocaleOption[];
}

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const [locales, setLocales] = useState<LocaleOption[]>(DEFAULT_LOCALES);

  useEffect(() => {
    fetch(`${API}/locales`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<LocalesResponse>;
      })
      .then((data) => {
        if (Array.isArray(data.locales) && data.locales.length > 0) {
          setLocales(
            data.locales.map((l) => ({
              code: String(l.code),
              name: String(l.name),
              flag: String(l.flag),
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  const current = locales.find((l) => l.code === i18n.language) ?? locales[0];

  function changeLanguage(code: string) {
    i18n.changeLanguage(code);
    if (token) {
      fetch(`${API}/user/locale`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ locale: code }),
      }).catch(() => {});
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-primary-foreground gap-1.5 px-2">
          <span className="text-base leading-none">{current?.flag}</span>
          <span className="text-xs uppercase">{current?.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            onClick={() => changeLanguage(locale.code)}
            className={i18n.language === locale.code ? "bg-accent" : ""}
          >
            <span className="text-base mr-2">{locale.flag}</span>
            <span className="text-sm">{locale.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
