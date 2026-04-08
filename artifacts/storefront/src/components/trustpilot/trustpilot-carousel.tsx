import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { useTrustpilot, useTrustpilotWidget } from "@/hooks/use-trustpilot";
import { TrustpilotStars, TrustpilotLogo } from "./trustpilot-stars";

interface Review {
  id: number; name: string; rating: number; text: string; date: string;
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
  const { enabled, cachedRating, cachedCount, trustpilotUrl, businessUnitId, loaded } = useTrustpilot();
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetLoaded = useTrustpilotWidget(widgetRef, businessUnitId);

  if (!loaded || !enabled) return null;

  return (
    <section className="py-12 bg-gradient-to-b from-green-50/50 to-white rounded-2xl px-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-3">
          <TrustpilotLogo className="text-lg" />
        </div>
        <h2 className="text-2xl font-bold mb-2">What Our Customers Say</h2>
        <div className="flex items-center justify-center gap-2">
          <TrustpilotStars rating={cachedRating} size="lg" />
          <span className="text-lg font-semibold">{cachedRating.toFixed(1)}</span>
          <span className="text-muted-foreground">based on {cachedCount.toLocaleString()} reviews</span>
        </div>
      </div>

      {businessUnitId && (
        <div ref={widgetRef} className="trustpilot-widget max-w-4xl mx-auto" data-locale="en-US"
          data-template-id="53aa8912dec7e10d38f59f36" data-businessunit-id={businessUnitId}
          data-style-height="140px" data-style-width="100%" data-theme="light" data-stars="4,5"
          style={{ display: widgetLoaded ? "block" : "none" }} />
      )}
      {!widgetLoaded && <FallbackCarousel />}

      {trustpilotUrl && (
        <div className="text-center mt-6">
          <a href={trustpilotUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-green-600 hover:text-green-700 font-medium hover:underline">
            Read all reviews on Trustpilot →
          </a>
        </div>
      )}
    </section>
  );
}

function FallbackCarousel() {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const visibleCount = 3;
  const maxIndex = STATIC_REVIEWS.length - visibleCount;

  useEffect(() => {
    intervalRef.current = setInterval(() => setCurrent((p) => (p >= maxIndex ? 0 : p + 1)), 5000);
    return () => clearInterval(intervalRef.current);
  }, [maxIndex]);

  return (
    <div className="relative max-w-5xl mx-auto">
      <button onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md flex items-center justify-center disabled:opacity-30 hover:bg-muted">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="overflow-hidden">
        <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${current * (100 / visibleCount)}%)` }}>
          {STATIC_REVIEWS.map((review) => (
            <div key={review.id} className="w-1/3 flex-shrink-0 px-3">
              <div className="bg-card border rounded-xl p-5 h-full flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <TrustpilotStars rating={review.rating} size="sm" />
                  <Quote className="h-4 w-4 text-green-200" />
                </div>
                <p className="text-sm text-gray-700 flex-1 leading-relaxed mb-4">"{review.text}"</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-gray-900">{review.name}</span>
                  <span>{review.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setCurrent((p) => Math.min(maxIndex, p + 1))} disabled={current >= maxIndex}
        className="absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-card shadow-md flex items-center justify-center disabled:opacity-30 hover:bg-muted">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
