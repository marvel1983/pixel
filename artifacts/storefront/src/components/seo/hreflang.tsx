import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES } from "@/i18n";

export function HreflangTags() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const existing = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existing.forEach((el) => el.remove());

    const base = window.location.origin;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    SUPPORTED_LOCALES.forEach((locale) => {
      const p = new URLSearchParams(params);
      p.set("lang", locale.code);
      const link = document.createElement("link");
      link.rel = "alternate";
      link.hreflang = locale.code;
      link.href = `${base}${path}?${p.toString()}`;
      document.head.appendChild(link);
    });

    const xDefault = document.createElement("link");
    xDefault.rel = "alternate";
    xDefault.hreflang = "x-default";
    const defaultParams = new URLSearchParams(params);
    defaultParams.delete("lang");
    const qs = defaultParams.toString();
    xDefault.href = `${base}${path}${qs ? `?${qs}` : ""}`;
    document.head.appendChild(xDefault);

    document.documentElement.lang = i18n.language;

    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = t("footer.tagline");
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = desc;
      document.head.appendChild(meta);
    }

    return () => {
      document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    };
  }, [i18n.language, t]);

  return null;
}
