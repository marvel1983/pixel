import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import pl from "./locales/pl.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import cs from "./locales/cs.json";

export const SUPPORTED_LOCALES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "cs", name: "Čeština", flag: "🇨🇿" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      pl: { translation: pl },
      de: { translation: de },
      fr: { translation: fr },
      cs: { translation: cs },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      lookupQuerystring: "lang",
      lookupLocalStorage: "pixelcodes_locale",
      caches: ["localStorage"],
    },
  });

const API = import.meta.env.VITE_API_URL ?? "/api";

export async function loadOverrides() {
  try {
    const lang = i18n.language || "en";
    const res = await fetch(`${API}/locales/overrides/${lang}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.overrides && typeof data.overrides === "object") {
      i18n.addResourceBundle(lang, "translation", data.overrides, true, true);
    }
  } catch {
  }
}

i18n.on("languageChanged", () => { loadOverrides(); });
loadOverrides();

export default i18n;
