import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useTrustpilot, useTrustpilotWidget } from "@/hooks/use-trustpilot";
import { TrustpilotStars, TrustpilotLogo } from "./trustpilot-stars";

interface Review {
  id: number;
  name: string;
  rating: number;
  text: string;
  date: string;
}

const STATIC_REVIEWS: Review[] = [
  { id: 1, name: "James T.", rating: 5, text: "Received my Windows 11 Pro key instantly. Activated without any issues. Best price I found online!", date: "2 days ago" },
  { id: 2, name: "Sarah M.", rating: 5, text: "Great experience! The Office 2021 key worked perfectly. Customer support was very responsive when I had a question.", date: "5 days ago" },
  { id: 3, name: "David K.", rating: 4, text: "Fast delivery and competitive prices. The activation guide was helpful. Will definitely buy again.", date: "1 week ago" },
  { id: 4, name: "Emma L.", rating: 5, text: "I was skeptical at first but everything went smoothly. Key arrived in seconds and activated on the first try!", date: "2 weeks ago" },
  { id: 5, name: "Michael R.", rating: 5, text: "Bought Norton 360 at an amazing price. Legitimate key, instant delivery. Highly recommended!", date: "2 weeks ago" },
  { id: 6, name: "Lisa P.", rating: 4, text: "Good prices and fast service. The checkout process was smooth and the key worked perfectly.", date: "3 weeks ago" },
];

export function TrustpilotCarousel() {
  const { t } = useTranslation();
  const { enabled, cachedRating, cachedCount, trustpilotUrl, businessUnitId, loaded } = useTrustpilot();
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetLoaded = useTrustpilotWidget(widgetRef, businessUnitId);

  if (!loaded || !enabled) return null;

  return (
    <section
      className="rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/[0.06] via-background to-muted/30 px-4 py-10 md:px-8 md:py-12"
      aria-labelledby="trustpilot-home-heading"
    >
      <div className="mb-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <TrustpilotLogo className="text-lg" />
        </div>
        <h2 id="trustpilot-home-heading" className="mb-2 text-2xl font-bold">
          {t("home.trustPilotHeading")}
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <TrustpilotStars rating={cachedRating} size="lg" />
          <span className="text-lg font-semibold">{cachedRating.toFixed(1)}</span>
          <span className="text-muted-foreground">
            {t("home.trustPilotReviews", { count: cachedCount.toLocaleString() })}
          </span>
        </div>
      </div>

      {businessUnitId && (
        <div
          ref={widgetRef}
          className="trustpilot-widget mx-auto max-w-4xl"
          data-locale="en-US"
          data-template-id="53aa8912dec7e10d38f59f36"
          data-businessunit-id={businessUnitId}
          data-style-height="140px"
          data-style-width="100%"
          data-theme="light"
          data-stars="4,5"
          style={{ display: widgetLoaded ? "block" : "none" }}
        />
      )}
      {!widgetLoaded && <FallbackCarousel />}

      {trustpilotUrl && (
        <div className="mt-6 text-center">
          <a
            href={trustpilotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("home.trustPilotReadAll")}
          </a>
        </div>
      )}
    </section>
  );
}

function FallbackCarousel() {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleCount = 3;
  const maxIndex = STATIC_REVIEWS.length - visibleCount;

  useEffect(() => {
    intervalRef.current = setInterval(() => setCurrent((p) => (p >= maxIndex ? 0 : p + 1)), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [maxIndex]);

  return (
    <div className="relative mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => setCurrent((p) => Math.max(0, p - 1))}
        disabled={current === 0}
        className="absolute -left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-md hover:bg-muted disabled:opacity-30"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${current * (100 / visibleCount)}%)` }}
        >
          {STATIC_REVIEWS.map((review) => (
            <div key={review.id} className="w-1/3 flex-shrink-0 px-3">
              <div className="flex h-full flex-col rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <TrustpilotStars rating={review.rating} size="sm" />
                  <Quote className="h-4 w-4 text-primary/30" />
                </div>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-foreground/90">"{review.text}"</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{review.name}</span>
                  <span>{review.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setCurrent((p) => Math.min(maxIndex, p + 1))}
        disabled={current >= maxIndex}
        className="absolute -right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-md hover:bg-muted disabled:opacity-30"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
