import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const BANNER_CONFIG = [
  { titleKey: "home.banner1Title", subtitleKey: "home.banner1Subtitle", ctaKey: "home.shopNow", ctaLink: "/product/windows-11-pro", bgColor: "from-blue-600 to-blue-800" },
  { titleKey: "home.banner2Title", subtitleKey: "home.banner2Subtitle", ctaKey: "home.banner2Cta", ctaLink: "/product/office-2024-pro-plus", bgColor: "from-orange-500 to-red-600" },
  { titleKey: "home.banner3Title", subtitleKey: "home.banner3Subtitle", ctaKey: "home.banner3Cta", ctaLink: "/category/games", bgColor: "from-purple-600 to-indigo-700" },
];

export function HeroBanner() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const total = BANNER_CONFIG.length;

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % total),
    [total],
  );
  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + total) % total),
    [total],
  );

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const banner = BANNER_CONFIG[current];

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      <div
        className={`bg-gradient-to-r ${banner.bgColor} px-8 py-16 md:py-20 text-white transition-all duration-500`}
      >
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-3">
            {t(banner.titleKey)}
          </h2>
          <p className="text-white/80 text-sm md:text-lg mb-6">
            {t(banner.subtitleKey)}
          </p>
          <Link href={banner.ctaLink}>
            <Button
              size="lg"
              className="bg-white text-slate-900 hover:bg-white/90 font-semibold"
            >
              {t(banner.ctaKey)}
            </Button>
          </Link>
        </div>
      </div>

      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
        aria-label={t("common.previous")}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50 transition-colors"
        aria-label={t("common.next")}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {BANNER_CONFIG.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === current ? "bg-white" : "bg-white/40"
            }`}
            aria-label={`${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
