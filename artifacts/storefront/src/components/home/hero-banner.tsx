import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { MOCK_BANNERS } from "@/lib/mock-data";

export function HeroBanner() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const total = MOCK_BANNERS.length;

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

  const banner = MOCK_BANNERS[current];

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      <div className="relative h-[280px] md:h-[360px] transition-all duration-500">
        <img
          src={banner.imageUrl}
          alt={banner.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        <div className="relative h-full flex items-center px-8 md:px-16">
          <div className="max-w-lg">
            <h2 className="text-2xl md:text-4xl font-bold mb-3 text-white drop-shadow-lg">
              {banner.title}
            </h2>
            <p className="text-white/90 text-sm md:text-lg mb-6 drop-shadow">
              {banner.subtitle}
            </p>
            <Link href={banner.ctaLink}>
              <Button
                size="lg"
                className="bg-white text-slate-900 hover:bg-white/90 font-semibold"
              >
                {banner.ctaText}
              </Button>
            </Link>
          </div>
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
        {MOCK_BANNERS.map((_, i) => (
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
