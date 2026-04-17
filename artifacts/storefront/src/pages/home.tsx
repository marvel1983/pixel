import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { MockProduct } from "@/lib/mock-data";
import { HeroBanner } from "@/components/home/hero-banner";
import { CategorySidebar } from "@/components/home/category-sidebar";
import { FeaturedSpotlight } from "@/components/home/featured-spotlight";
import { NewAdditions } from "@/components/home/new-additions";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { FeaturedBundles } from "@/components/home/featured-bundles";
import { TrustpilotCarousel } from "@/components/trustpilot/trustpilot-carousel";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/json-ld";
import { TrustBar } from "@/components/home/trust-bar";
import { StatsStrip } from "@/components/home/stats-strip";
import { ShopByBrand } from "@/components/home/shop-by-brand";
import { PromoBanner } from "@/components/home/promo-banner";
import { PageSection } from "@/components/home/page-section";
import { CategoryBrowseTabs } from "@/components/home/category-browse-tabs";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Section {
  id: number;
  type: string;
  title: string | null;
  isEnabled: boolean;
  sortOrder: number;
  config: Record<string, unknown>;
}

interface ApiVariant {
  id: number; name: string; sku: string; platform: string | null;
  priceUsd: string; compareAtPriceUsd: string | null; stockCount: number;
}
interface ApiProduct {
  id: number; name: string; slug: string; imageUrl: string | null;
  avgRating: string | null; reviewCount: number; isFeatured: boolean;
  categorySlug: string | null; regionRestrictions?: string[];
  platformType?: string | null; variants: ApiVariant[];
}

function toMockProduct(p: ApiProduct): MockProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl,
    categorySlug: p.categorySlug ?? "",
    avgRating: Number(p.avgRating ?? 0),
    reviewCount: p.reviewCount,
    isFeatured: p.isFeatured,
    isNew: false,
    regionRestrictions: p.regionRestrictions ?? [],
    platformType: p.platformType ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      platform: v.platform ?? "",
      priceUsd: v.priceUsd,
      compareAtPriceUsd: v.compareAtPriceUsd,
      stockCount: v.stockCount,
    })),
  };
}

async function fetchProducts(params: Record<string, string>): Promise<MockProduct[]> {
  const p = new URLSearchParams({ limit: "12", stock: "1", ...params });
  const r = await fetch(`${API}/products?${p}`);
  if (!r.ok) return [];
  const d = await r.json() as { items?: ApiProduct[] };
  return (d.items ?? []).map(toMockProduct);
}

const CATEGORY_TABS = [
  { value: "operating-systems",   categorySlug: "operating-systems",   labelKey: "home.categoryTabOs" },
  { value: "office-productivity", categorySlug: "office-productivity", labelKey: "home.categoryTabOffice" },
  { value: "antivirus-security",  categorySlug: "antivirus-security",  labelKey: "home.categoryTabSecurity" },
  { value: "games",               categorySlug: "games",               labelKey: "home.categoryTabGames" },
  { value: "servers-development", categorySlug: "servers-development", labelKey: "home.categoryTabDev" },
];

const ALL_TYPES = [
  "HERO_SLIDER", "CATEGORY_ROW", "BRAND_SECTIONS",
  "PRODUCT_SPOTLIGHT", "FEATURED_TEXT_BANNER", "NEW_ADDITIONS", "FEATURED_BUNDLES",
];

const SECTION_VARIANT: Partial<Record<string, "default" | "muted" | "card">> = {
  CATEGORY_ROW: "card",
  BRAND_SECTIONS: "default",
  PRODUCT_SPOTLIGHT: "muted",
  NEW_ADDITIONS: "default",
  FEATURED_BUNDLES: "card",
};

interface HomepageProducts {
  featured: MockProduct[];
  byCategory: Record<string, MockProduct[]>;
}

export default function HomePage() {
  const { t } = useTranslation();
  const [sectionTypes, setSectionTypes] = useState<string[]>(ALL_TYPES);
  const [hp, setHp] = useState<HomepageProducts>({ featured: [], byCategory: {} });

  useEffect(() => {
    setSeoMeta({ title: t("seo.homeTitle"), description: t("seo.homeDescription") });
    return () => { clearSeoMeta(); };
  }, [t]);

  useEffect(() => {
    fetch(`${API}/homepage-sections`)
      .then((r) => r.json())
      .then((d: { sections: Section[] }) => {
        if (!d.sections?.length) return;
        const ordered = [...d.sections]
          .filter((s) => s.isEnabled !== false)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => s.type);
        if (ordered.length) setSectionTypes(ordered);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetch all product data in parallel
    const categoryFetches = CATEGORY_TABS.map(({ categorySlug }) =>
      fetchProducts({ cat: categorySlug }).then((items) => [categorySlug, items] as const)
    );
    const featuredFetch = fetchProducts({ featured: "1" });

    Promise.all([featuredFetch, ...categoryFetches]).then(([featured, ...catResults]) => {
      const byCategory: Record<string, MockProduct[]> = {};
      for (const [slug, items] of catResults) byCategory[slug] = items;
      setHp({ featured, byCategory });
    }).catch(() => {});
  }, []);

  function renderSection(type: string): ReactNode {
    switch (type) {
      case "HERO_SLIDER":
        return null;
      case "CATEGORY_ROW":
        return (
          <CategoryBrowseTabs
            eyebrow={t("home.sectionEyebrowShop")}
            title={t("home.browseByCategory")}
            tabs={CATEGORY_TABS.map((tab) => ({
              ...tab,
              products: hp.byCategory[tab.categorySlug] ?? [],
            }))}
          />
        );
      case "BRAND_SECTIONS":
        return <ShopByBrand />;
      case "PRODUCT_SPOTLIGHT":
        return <FeaturedSpotlight products={hp.featured} />;
      case "NEW_ADDITIONS":
        return <NewAdditions products={hp.featured.filter((_, i) => i < 6)} />;
      case "FEATURED_BUNDLES":
        return <FeaturedBundles />;
      default:
        return null;
    }
  }

  const otherSections = sectionTypes.filter((s) => s !== "HERO_SLIDER");
  const spotlightIdx = otherSections.indexOf("PRODUCT_SPOTLIGHT");
  const beforePromo = spotlightIdx >= 0 ? otherSections.slice(0, spotlightIdx) : otherSections;
  const afterPromo = spotlightIdx >= 0 ? otherSections.slice(spotlightIdx) : [];

  function renderBlocks(types: string[]) {
    return types.map((type) => {
      const inner = renderSection(type);
      if (!inner) return null;
      const variant = SECTION_VARIANT[type] ?? "default";
      return <PageSection key={type} variant={variant}>{inner}</PageSection>;
    });
  }

  return (
    <div>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <div className="bg-muted/20">
        <div className="container mx-auto px-4 pb-4 pt-6 lg:pt-8">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
            <CategorySidebar />
            <HeroBanner />
          </div>
          <TrustBar className="mt-3" />
          <StatsStrip className="mt-3" />
        </div>
      </div>
      <div className="container mx-auto space-y-6 px-4 pt-3 pb-6">
        {renderBlocks(beforePromo)}
        {spotlightIdx >= 0 && <PromoBanner />}
        {renderBlocks(afterPromo)}
        <TrustpilotCarousel />
        <RecentlyViewed />
      </div>
    </div>
  );
}
