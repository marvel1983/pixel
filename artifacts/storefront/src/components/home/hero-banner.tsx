import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

/* ─── Slide data ─────────────────────────────────────────── */
interface Slide {
  id: number;
  badge: string;
  headline: string;
  headlineAccent: string;
  sub: string;
  cta: string;
  ctaLink: string;
  secondaryCta: string;
  secondaryLink: string;
  price?: string;
  /** bg gradient class */
  bg: string;
  /** main accent hex */
  accent: string;
  /** illustration variant */
  visual: "windows" | "office" | "games" | "security";
}

const SLIDES: Slide[] = [
  {
    id: 1,
    badge: "LIMITED DEAL",
    headline: "Windows 11 Pro",
    headlineAccent: "Save up to 85%",
    sub: "Genuine retail key. Instant email delivery. Activate in minutes.",
    cta: "Get for $8.99",
    ctaLink: "/category/operating-systems",
    secondaryCta: "See all Windows",
    secondaryLink: "/category/operating-systems",
    price: "Was $199.99",
    bg: "from-[#050e1f] via-[#0b1f3d] to-[#07152e]",
    accent: "#38bdf8",
    visual: "windows",
  },
  {
    id: 2,
    badge: "JUST RELEASED",
    headline: "Microsoft Office",
    headlineAccent: "2024 — Lifetime",
    sub: "Word, Excel, PowerPoint, Outlook — one payment, no subscription treadmill.",
    cta: "Shop Office",
    ctaLink: "/category/office-productivity",
    secondaryCta: "Compare editions",
    secondaryLink: "/category/office-productivity",
    price: "From $19.99",
    bg: "from-[#1a0c00] via-[#3a1800] to-[#1a0c00]",
    accent: "#fb923c",
    visual: "office",
  },
  {
    id: 3,
    badge: "HOT DEALS",
    headline: "PC Game Keys",
    headlineAccent: "Up to 50% Off",
    sub: "Steam · Epic · Ubisoft. Instant activation on your favourite platform.",
    cta: "Browse Games",
    ctaLink: "/category/games",
    secondaryCta: "View new arrivals",
    secondaryLink: "/new-arrivals",
    price: "Keys from $2.99",
    bg: "from-[#0d0019] via-[#1e0040] to-[#0d0019]",
    accent: "#c084fc",
    visual: "games",
  },
  {
    id: 4,
    badge: "TOP PROTECTION",
    headline: "Antivirus &",
    headlineAccent: "Security Suites",
    sub: "Norton · Kaspersky · Bitdefender. Award-winning protection, up to 80% off retail.",
    cta: "Stay Secure",
    ctaLink: "/category/antivirus-security",
    secondaryCta: "Compare products",
    secondaryLink: "/category/antivirus-security",
    price: "From $9.99/yr",
    bg: "from-[#001409] via-[#002d16] to-[#001409]",
    accent: "#4ade80",
    visual: "security",
  },
];

/* ─── Decorative visuals (pure SVG/CSS, right panel) ────── */

function VisualWindows({ accent }: { accent: string }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* large faint circle */}
      <div className="absolute w-72 h-72 rounded-full border-2 opacity-10" style={{ borderColor: accent }} />
      <div className="absolute w-52 h-52 rounded-full border opacity-15" style={{ borderColor: accent }} />
      {/* Windows 4-pane logo in CSS */}
      <div className="relative z-10 opacity-90" style={{ filter: `drop-shadow(0 0 24px ${accent}66)` }}>
        <div className="grid grid-cols-2 gap-2" style={{ width: 96, height: 96 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-sm"
              style={{ background: accent, opacity: 0.85 + i * 0.04 }}
            />
          ))}
        </div>
      </div>
      {/* floating price tag */}
      <div
        className="absolute bottom-8 right-4 rounded-xl px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}
      >
        From $8.99
      </div>
    </div>
  );
}

function VisualOffice({ accent }: { accent: string }) {
  const docs = [
    { rotate: "-12deg", translate: "-20px, 10px", opacity: 0.4 },
    { rotate: "-5deg", translate: "-8px, 4px", opacity: 0.65 },
    { rotate: "0deg", translate: "0px, 0px", opacity: 1 },
  ];
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <div className="absolute w-64 h-64 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${accent}66, transparent 70%)` }} />
      <div className="relative z-10 flex items-center justify-center" style={{ width: 110, height: 130 }}>
        {docs.map((d, i) => (
          <div
            key={i}
            className="absolute rounded-lg"
            style={{
              width: 80, height: 100,
              background: i === 2 ? `linear-gradient(160deg, ${accent}, ${accent}bb)` : `${accent}${i === 1 ? "55" : "33"}`,
              border: `1px solid ${accent}${i === 2 ? "88" : "33"}`,
              transform: `rotate(${d.rotate}) translate(${d.translate})`,
              opacity: d.opacity,
            }}
          >
            {i === 2 && (
              <div className="p-2 space-y-1.5 mt-2">
                {[1, 0.7, 0.5, 0.7, 0.4].map((w, j) => (
                  <div key={j} className="h-1 rounded-full bg-white/40" style={{ width: `${w * 100}%` }} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        className="absolute bottom-8 right-4 rounded-xl px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}
      >
        From $19.99
      </div>
    </div>
  );
}

function VisualGames({ accent }: { accent: string }) {
  const hexSize = 22;
  const cols = 5; const rows = 4;
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* hex grid bg */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 160">
        {Array.from({ length: rows }).map((_, row) =>
          Array.from({ length: cols }).map((_, col) => {
            const x = col * hexSize * 1.75 + (row % 2 === 1 ? hexSize * 0.875 : 0) + 10;
            const y = row * hexSize * 1.5 + 10;
            const pts = Array.from({ length: 6 }).map((_, k) => {
              const angle = (Math.PI / 180) * (60 * k - 30);
              return `${x + hexSize * 0.8 * Math.cos(angle)},${y + hexSize * 0.8 * Math.sin(angle)}`;
            }).join(" ");
            return <polygon key={`${row}-${col}`} points={pts} fill="none" stroke={accent} strokeWidth="0.8" />;
          })
        )}
      </svg>
      {/* controller icon */}
      <div className="relative z-10" style={{ filter: `drop-shadow(0 0 20px ${accent}88)` }}>
        <svg width="90" height="65" viewBox="0 0 90 65" fill="none">
          <rect x="5" y="15" width="80" height="38" rx="19" fill={`${accent}33`} stroke={accent} strokeWidth="1.5" />
          <rect x="16" y="29" width="6" height="12" rx="3" fill={accent} opacity="0.9" />
          <rect x="12" y="33" width="14" height="4" rx="2" fill={accent} opacity="0.9" />
          <circle cx="65" cy="30" r="4" fill={accent} opacity="0.9" />
          <circle cx="72" cy="36" r="4" fill={accent} opacity="0.7" />
          <circle cx="58" cy="36" r="4" fill={accent} opacity="0.7" />
          <circle cx="65" cy="42" r="4" fill={accent} opacity="0.5" />
          <rect x="37" y="24" width="16" height="6" rx="3" fill={`${accent}55`} stroke={accent} strokeWidth="1" />
        </svg>
      </div>
      <div
        className="absolute bottom-8 right-4 rounded-xl px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}
      >
        From $2.99
      </div>
    </div>
  );
}

function VisualSecurity({ accent }: { accent: string }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* concentric rings */}
      {[120, 90, 65].map((size, i) => (
        <div
          key={size}
          className="absolute rounded-full"
          style={{
            width: size, height: size,
            border: `1.5px solid ${accent}`,
            opacity: 0.12 + i * 0.08,
          }}
        />
      ))}
      {/* shield */}
      <div className="relative z-10" style={{ filter: `drop-shadow(0 0 22px ${accent}77)` }}>
        <svg width="72" height="82" viewBox="0 0 72 82" fill="none">
          <path
            d="M36 4L8 14v22c0 18 12 32 28 40 16-8 28-22 28-40V14L36 4z"
            fill={`${accent}25`}
            stroke={accent}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M36 16L18 23v15c0 11 8 20 18 25 10-5 18-14 18-25V23L36 16z"
            fill={`${accent}40`}
          />
          {/* checkmark */}
          <path d="M26 38l7 8 13-14" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div
        className="absolute bottom-8 right-4 rounded-xl px-3 py-1.5 text-xs font-bold backdrop-blur-sm"
        style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}
      >
        From $9.99/yr
      </div>
    </div>
  );
}

function SlideVisual({ visual, accent }: { visual: Slide["visual"]; accent: string }) {
  if (visual === "windows") return <VisualWindows accent={accent} />;
  if (visual === "office") return <VisualOffice accent={accent} />;
  if (visual === "games") return <VisualGames accent={accent} />;
  return <VisualSecurity accent={accent} />;
}

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

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl shadow-2xl shadow-black/30"
      style={{ minHeight: 220, height: "clamp(220px, 30vw, 380px)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${s.bg} transition-all duration-700`}
      />

      {/* Noise/grid texture */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-700"
        style={{ background: `radial-gradient(ellipse 60% 80% at 80% 50%, ${s.accent}18, transparent 70%)` }}
      />

      {/* Content + Visual: 2-column */}
      <div
        className={`relative h-full grid grid-cols-[1fr] sm:grid-cols-[1fr_180px] lg:grid-cols-[1fr_220px] transition-opacity duration-200 ${fading ? "opacity-0" : "opacity-100"}`}
      >
        {/* Left: text */}
        <div className="flex flex-col justify-center px-5 py-4 sm:px-8 sm:py-6">
          {/* Badge */}
          <div className="mb-3 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: `${s.accent}20`, border: `1px solid ${s.accent}40`, color: s.accent }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.accent }} />
              {s.badge}
            </span>
            {s.price && (
              <span className="text-[11px] text-white/40 line-through">{s.price}</span>
            )}
          </div>

          {/* Headline */}
          <h2 className="mb-2 text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight text-white tracking-tight">
            {s.headline}
            <span className="block" style={{ color: s.accent }}>{s.headlineAccent}</span>
          </h2>

          {/* Sub */}
          <p className="mb-6 max-w-sm text-sm leading-relaxed text-white/60">
            {s.sub}
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            <Link href={s.ctaLink}>
              <button
                className="rounded-lg px-5 py-2.5 text-sm font-bold transition-all hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  background: s.accent,
                  color: "#000",
                  boxShadow: `0 0 20px ${s.accent}55`,
                }}
              >
                {s.cta}
              </button>
            </Link>
            <Link href={s.secondaryLink}>
              <button className="rounded-lg border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white">
                {s.secondaryCta}
              </button>
            </Link>
          </div>
        </div>

        {/* Right: illustration — hidden on xs, visible sm+ */}
        <div className="relative overflow-hidden hidden sm:block">
          <SlideVisual visual={s.visual} accent={s.accent} />
        </div>
      </div>

      {/* Slide counter top-right */}
      <div className="absolute top-3 right-3 font-mono text-[10px] text-white/25 tabular-nums select-none">
        {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      {/* Nav arrows */}
      <button
        type="button"
        onClick={prev}
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
        aria-label={t("common.previous")}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={next}
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
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
            className="rounded-full transition-all duration-300 hover:opacity-100"
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              background: i === current ? s.accent : "rgba(255,255,255,0.35)",
              opacity: i === current ? 1 : 0.6,
              boxShadow: i === current ? `0 0 8px ${s.accent}88` : "none",
            }}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
