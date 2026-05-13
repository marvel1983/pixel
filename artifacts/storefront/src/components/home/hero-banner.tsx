import { useState, useEffect, useCallback, useRef, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WinProHeroSlide } from "./win-pro-hero-slide";
import { Win10ProHeroSlide } from "./win10-pro-hero-slide";
import { Office2024HeroSlide } from "./office-2024-hero-slide";

interface Slide {
  id: number;
  /** React component that renders the entire slide (handles its own CTAs) */
  component: ComponentType;
}

const SLIDES: Slide[] = [
  { id: 1, component: Win10ProHeroSlide },
  { id: 2, component: WinProHeroSlide },
  { id: 3, component: Office2024HeroSlide },
];

/* ─── Main component ─────────────────────────────────────── */
export function HeroBanner() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fading, setFading] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const goTo = useCallback((idx: number) => {
    if (reduceMotion.current) { setCurrent(idx); return; }
    setFading(true);
    setTimeout(() => { setCurrent(idx); setFading(false); }, 220);
  }, []);

  const total = SLIDES.length;
  const next = useCallback(() => goTo((current + 1) % total), [current, total, goTo]);
  const prev = useCallback(() => goTo((current - 1 + total) % total), [current, total, goTo]);

  useEffect(() => {
    if (paused || reduceMotion.current) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [next, paused]);

  const s = SLIDES[current];
  const SlideComponent = s.component;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ minHeight: 286, height: "clamp(286px, 43vw, 740px)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide content */}
      <div className={`relative h-full w-full transition-opacity duration-200 ${fading ? "opacity-0" : "opacity-100"}`}>
        <SlideComponent />
      </div>

      {/* Slide counter top-right */}
      <div className="absolute top-3 right-3 font-mono text-[10px] text-white/60 tabular-nums select-none mix-blend-multiply">
        {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* Nav arrows */}
      <button
        type="button"
        onClick={prev}
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50"
        aria-label={t("common.previous")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-black/30 text-white backdrop-blur-md transition-colors hover:bg-black/50"
        aria-label={t("common.next")}
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goTo(i)}
            className="rounded-full transition-[opacity,transform] duration-300 hover:opacity-100"
            style={{
              width: 8,
              height: 8,
              transform: i === current ? "scaleX(3)" : "scaleX(1)",
              background: i === current ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.25)",
              opacity: i === current ? 1 : 0.6,
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
