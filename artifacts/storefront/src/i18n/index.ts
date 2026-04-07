import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCore from "./locales/en.json";
import enPages from "./locales/en-pages.json";
import plCore from "./locales/pl.json";
import plPages from "./locales/pl-pages.json";
import deCore from "./locales/de.json";
import dePages from "./locales/de-pages.json";
import frCore from "./locales/fr.json";
import frPages from "./locales/fr-pages.json";
import csCore from "./locales/cs.json";
import csPages from "./locales/cs-pages.json";

const en = { ...enCore, ...enPages };
const pl = { ...plCore, ...plPages };
const de = { ...deCore, ...dePages };
const fr = { ...frCore, ...frPages };
const cs = { ...csCore, ...csPages };

export interface EnabledLocale {
  code: string;
  name: string;
  flag: string;
  isDefault: boolean;
}

export const SUPPORTED_LOCALES = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "cs", name: "Čeština", flag: "🇨🇿" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

let enabledLocales: EnabledLocale[] = [...SUPPORTED_LOCALES.map(
  (l) => ({ ...l, isDefault: l.code === "en" }),
)];

type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function getEnabledLocales(): EnabledLocale[] {
  return enabledLocales;
}

export function onLocalesChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notifyLocalesChanged() {
  listeners.forEach((fn) => fn());
}

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

export async function syncEnabledLocales() {
  try {
    const res = await fetch(`${API}/locales`);
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.locales) || data.locales.length === 0) return;

    enabledLocales = data.locales;
    const enabledCodes = enabledLocales.map((l: EnabledLocale) => l.code);
    const adminDefault = enabledLocales.find((l: EnabledLocale) => l.isDefault);
    const fallback = adminDefault?.code || "en";

    i18n.options.supportedLngs = [...enabledCodes, "cimode"];
    i18n.options.fallbackLng = [fallback];

    if (!enabledCodes.includes(i18n.language)) {
      i18n.changeLanguage(fallback);
    }

    notifyLocalesChanged();
  } catch {
  }
}

i18n.on("languageChanged", () => { loadOverrides(); });

syncEnabledLocales().then(() => loadOverrides());

export default i18n;
