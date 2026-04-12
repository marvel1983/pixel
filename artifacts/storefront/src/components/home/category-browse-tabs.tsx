import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { ChevronRight, ArrowRight, Tag, Zap, ShieldCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

export interface CategoryTabDef {
  value: string;
  categorySlug: string;
  labelKey: string;
  products: MockProduct[];
}

/* ── Per-category inline banners ─────────────────────────── */
interface BannerConfig {
  bg: string;
  accent: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
  illustration: React.ReactNode;
}

function getBannerConfig(categorySlug: string, href: string): BannerConfig {
  switch (categorySlug) {
    case "operating-systems":
      return {
        bg: "linear-gradient(120deg, #0a1628 0%, #0d2a50 60%, #1a3a6a 100%)",
        accent: "#3b82f6",
        eyebrow: "Limited time",
        headline: "Windows 10 & 11 keys from $12.99",
        sub: "Genuine Microsoft activation — identical to retail box.",
        cta: "Shop Windows",
        href,
        illustration: (
          <svg width="110" height="72" viewBox="0 0 110 72" fill="none">
            <rect x="4" y="4" width="48" height="30" rx="3" fill="#1a3a6a" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="56" y="4" width="48" height="30" rx="3" fill="#1a3a6a" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="4" y="38" width="48" height="30" rx="3" fill="#1a3a6a" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="56" y="38" width="48" height="30" rx="3" fill="#1a3a6a" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="10" y="10" width="36" height="18" rx="1.5" fill="#F25022" opacity="0.9"/>
            <rect x="62" y="10" width="36" height="18" rx="1.5" fill="#7FBA00" opacity="0.9"/>
            <rect x="10" y="44" width="36" height="18" rx="1.5" fill="#00A4EF" opacity="0.9"/>
            <rect x="62" y="44" width="36" height="18" rx="1.5" fill="#FFB900" opacity="0.9"/>
          </svg>
        ),
      };
    case "office-productivity":
      return {
        bg: "linear-gradient(120deg, #1a0a28 0%, #2d1050 60%, #3d1a70 100%)",
        accent: "#a855f7",
        eyebrow: "Lifetime license",
        headline: "Office 2024 Pro Plus — no subscription",
        sub: "Word, Excel, PowerPoint & more. One payment, yours forever.",
        cta: "Browse Office",
        href,
        illustration: (
          <svg width="110" height="72" viewBox="0 0 110 72" fill="none">
            <rect x="15" y="6" width="80" height="60" rx="4" fill="#2d1050" stroke="#a855f7" strokeWidth="1.5"/>
            <rect x="25" y="16" width="60" height="6" rx="2" fill="#a855f7" opacity="0.4"/>
            <rect x="25" y="26" width="45" height="4" rx="2" fill="#a855f7" opacity="0.25"/>
            <rect x="25" y="34" width="55" height="4" rx="2" fill="#a855f7" opacity="0.25"/>
            <rect x="25" y="42" width="38" height="4" rx="2" fill="#a855f7" opacity="0.25"/>
            <rect x="25" y="52" width="50" height="4" rx="2" fill="#a855f7" opacity="0.25"/>
            <circle cx="86" cy="16" r="10" fill="#a855f7" opacity="0.15" stroke="#a855f7" strokeWidth="1"/>
            <text x="82" y="20" fill="#a855f7" fontSize="9" fontWeight="700">W</text>
          </svg>
        ),
      };
    case "antivirus-security":
      return {
        bg: "linear-gradient(120deg, #0a1e0a 0%, #0d3a1a 60%, #0a2e14 100%)",
        accent: "#22c55e",
        eyebrow: "Full protection",
        headline: "Top antivirus suites from $14.99/yr",
        sub: "Bitdefender, Norton, Kaspersky & more. Multi-device plans included.",
        cta: "See security deals",
        href,
        illustration: (
          <svg width="110" height="72" viewBox="0 0 110 72" fill="none">
            <path d="M55 6 L90 18 L90 42 C90 56 72 66 55 70 C38 66 20 56 20 42 L20 18 Z" fill="#0d3a1a" stroke="#22c55e" strokeWidth="1.5"/>
            <path d="M55 16 L78 25 L78 42 C78 51 66 59 55 62 C44 59 32 51 32 42 L32 25 Z" fill="#22c55e" opacity="0.12"/>
            <path d="M44 36 L51 43 L68 28" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ),
      };
    case "games":
      return {
        bg: "linear-gradient(120deg, #1a0808 0%, #3a0d0d 60%, #500a0a 100%)",
        accent: "#ef4444",
        eyebrow: "Hot deals",
        headline: "Top Steam keys — up to 80% off retail",
        sub: "Elden Ring, Baldur's Gate 3, GTA V & more. Instant delivery.",
        cta: "Browse games",
        href,
        illustration: (
          <svg width="110" height="72" viewBox="0 0 110 72" fill="none">
            <rect x="10" y="18" width="90" height="36" rx="18" fill="#3a0d0d" stroke="#ef4444" strokeWidth="1.5"/>
            <circle cx="30" cy="36" r="10" fill="#ef4444" opacity="0.15" stroke="#ef4444" strokeWidth="1"/>
            <rect x="26" y="34" width="8" height="2" rx="1" fill="#ef4444"/>
            <rect x="29" y="31" width="2" height="8" rx="1" fill="#ef4444"/>
            <circle cx="78" cy="31" r="3" fill="#ef4444" opacity="0.7"/>
            <circle cx="85" cy="36" r="3" fill="#ef4444" opacity="0.5"/>
            <circle cx="78" cy="41" r="3" fill="#ef4444" opacity="0.3"/>
            <circle cx="71" cy="36" r="3" fill="#ef4444" opacity="0.5"/>
            <circle cx="55" cy="28" r="2" fill="#ef4444" opacity="0.4"/>
            <circle cx="55" cy="44" r="2" fill="#ef4444" opacity="0.4"/>
          </svg>
        ),
      };
    default:
      return {
        bg: "linear-gradient(120deg, #0a1628 0%, #0d2346 60%, #162d5a 100%)",
        accent: "#3b82f6",
        eyebrow: "Developer tools",
        headline: "Professional software at unbeatable prices",
        sub: "Visual Studio, JetBrains, SQL Server & more. Verified licenses.",
        cta: "View all",
        href,
        illustration: (
          <svg width="110" height="72" viewBox="0 0 110 72" fill="none">
            <rect x="8" y="10" width="94" height="52" rx="4" fill="#0d2346" stroke="#3b82f6" strokeWidth="1.5"/>
            <rect x="8" y="10" width="94" height="14" rx="4" fill="#3b82f6" opacity="0.2"/>
            <circle cx="20" cy="17" r="3" fill="#ef4444" opacity="0.7"/>
            <circle cx="30" cy="17" r="3" fill="#f59e0b" opacity="0.7"/>
            <circle cx="40" cy="17" r="3" fill="#22c55e" opacity="0.7"/>
            <rect x="16" y="32" width="30" height="3" rx="1.5" fill="#3b82f6" opacity="0.6"/>
            <rect x="16" y="39" width="50" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
            <rect x="16" y="46" width="40" height="3" rx="1.5" fill="#3b82f6" opacity="0.3"/>
            <rect x="16" y="53" width="22" height="3" rx="1.5" fill="#a855f7" opacity="0.5"/>
          </svg>
        ),
      };
  }
}

function InlineBanner({ categorySlug, href }: { categorySlug: string; href: string }) {
  const cfg = getBannerConfig(categorySlug, href);
  return (
    <div
      className="relative my-3 overflow-hidden rounded-xl px-5 py-4 flex items-center justify-between gap-4"
      style={{ background: cfg.bg, border: `1px solid ${cfg.accent}22` }}
    >
      {/* Glow */}
      <div
        className="pointer-events-none absolute -left-10 top-1/2 -translate-y-1/2 h-32 w-32 rounded-full opacity-20 blur-2xl"
        style={{ background: cfg.accent }}
      />

      <div className="relative flex items-center gap-5 min-w-0">
        {/* Illustration */}
        <div className="hidden sm:block shrink-0">{cfg.illustration}</div>

        {/* Text */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: `${cfg.accent}22`, color: cfg.accent }}
            >
              {cfg.eyebrow}
            </span>
          </div>
          <p className="text-sm font-bold text-white leading-snug">{cfg.headline}</p>
          <p className="text-xs mt-0.5 text-white/50 hidden md:block">{cfg.sub}</p>
        </div>
      </div>

      <Link
        href={cfg.href}
        className="relative shrink-0 flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
        style={{ background: cfg.accent }}
      >
        {cfg.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ── Skeleton cards ───────────────────────────────────────── */
function SkeletonGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-muted" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-5 bg-muted rounded w-1/3 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export function CategoryBrowseTabs({ tabs, eyebrow, title }: { tabs: CategoryTabDef[]; eyebrow?: string; title?: string }) {
  const { t } = useTranslation();

  const firstValid = useMemo(
    () => tabs.find((x) => x.products.length > 0)?.value ?? tabs[0]?.value ?? "",
    [tabs],
  );

  const [active, setActive] = useState(firstValid);

  useEffect(() => {
    setActive(firstValid);
  }, [firstValid]);

  if (!tabs.length) return null;

  const activeDef = tabs.find((x) => x.value === active) ?? tabs[0];
  const activeSlug = activeDef?.categorySlug ?? "shop";

  return (
    <Tabs value={active} onValueChange={setActive} className="w-full">
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {title && (
          <div className="flex shrink-0 flex-col">
            {eyebrow && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary leading-none mb-0.5">
                {eyebrow}
              </span>
            )}
            <span className="text-base font-bold text-foreground leading-tight">{title}</span>
          </div>
        )}
        <div className="flex-1 min-w-0 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto min-h-9 w-max flex-nowrap justify-start gap-1 bg-muted/70 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                disabled={tab.products.length === 0}
                className="shrink-0 px-3 py-1.5 text-xs data-[state=active]:shadow-sm"
              >
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <Link
          href={`/category/${activeSlug}`}
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t("common.viewAll")}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Tab content */}
      {tabs.map((tab) => {
        const row1 = tab.products.slice(0, 5);
        const row2 = tab.products.slice(5, 10);

        return (
          <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
            {tab.products.length === 0 ? (
              <SkeletonGrid count={5} />
            ) : (
              <div>
                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {row1.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Inline banner */}
                <InlineBanner categorySlug={tab.categorySlug} href={`/category/${tab.categorySlug}`} />

                {/* Row 2 — only render if full row of 5 */}
                {row2.length === 5 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {row2.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
