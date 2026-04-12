import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
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

const windowsProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "operating-systems");
const officeProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "office-productivity");
const antivirusProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "antivirus-security");
const gameProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "games");
const devProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "servers-development");
const newProducts = MOCK_PRODUCTS.filter((p) => p.isNew);
const featuredProducts = MOCK_PRODUCTS.filter((p) => p.isFeatured);

const ALL_TYPES = [
  "HERO_SLIDER",
  "CATEGORY_ROW",
  "BRAND_SECTIONS",
  "PRODUCT_SPOTLIGHT",
  "FEATURED_TEXT_BANNER",
  "NEW_ADDITIONS",
  "FEATURED_BUNDLES",
];

const SECTION_VARIANT: Partial<Record<string, "default" | "muted" | "card">> = {
  CATEGORY_ROW: "card",
  BRAND_SECTIONS: "default",
  PRODUCT_SPOTLIGHT: "muted",
  NEW_ADDITIONS: "default",
  FEATURED_BUNDLES: "card",
};

function renderSection(type: string, t: (key: string, opts?: Record<string, string>) => string): ReactNode {
  switch (type) {
    case "HERO_SLIDER":
      return null;
    case "CATEGORY_ROW":
      return (
        <CategoryBrowseTabs
          eyebrow={t("home.sectionEyebrowShop")}
          title={t("home.browseByCategory")}
          tabs={[
            { value: "operating-systems", categorySlug: "operating-systems", labelKey: "home.categoryTabOs", products: windowsProducts },
            { value: "office-productivity", categorySlug: "office-productivity", labelKey: "home.categoryTabOffice", products: officeProducts },
            { value: "antivirus-security", categorySlug: "antivirus-security", labelKey: "home.categoryTabSecurity", products: antivirusProducts },
            { value: "games", categorySlug: "games", labelKey: "home.categoryTabGames", products: gameProducts },
            { value: "servers-development", categorySlug: "servers-development", labelKey: "home.categoryTabDev", products: devProducts },
          ]}
        />
      );
    case "BRAND_SECTIONS":
      return <ShopByBrand />;
    case "PRODUCT_SPOTLIGHT":
      return <FeaturedSpotlight products={featuredProducts} />;
    case "NEW_ADDITIONS":
      return <NewAdditions products={newProducts} />;
    case "FEATURED_BUNDLES":
      return <FeaturedBundles />;
    default:
      return null;
  }
}

export default function HomePage() {
  const { t } = useTranslation();
  const [sectionTypes, setSectionTypes] = useState<string[]>(ALL_TYPES);

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

  // Split: sections before and after PRODUCT_SPOTLIGHT to insert promo banner between them
  const otherSections = sectionTypes.filter((t) => t !== "HERO_SLIDER");
  const spotlightIdx = otherSections.indexOf("PRODUCT_SPOTLIGHT");
  const beforePromo = spotlightIdx >= 0 ? otherSections.slice(0, spotlightIdx) : otherSections;
  const afterPromo = spotlightIdx >= 0 ? otherSections.slice(spotlightIdx) : [];

  function renderBlocks(types: string[]) {
    return types.map((type) => {
      const inner = renderSection(type, t);
      if (!inner) return null;
      const variant = SECTION_VARIANT[type] ?? "default";
      return (
        <PageSection key={type} variant={variant}>
          {inner}
        </PageSection>
      );
    });
  }

  return (
    <div>
      <OrganizationJsonLd />
      <WebSiteJsonLd />

      {/* Hero + trust + stats */}
      <div className="bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 pb-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {/* Sidebar + banner: sidebar hidden on mobile */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
            <CategorySidebar />
            <HeroBanner />
          </div>
          <TrustBar className="mt-3" />
          <StatsStrip className="mt-3" />
        </div>
      </div>

      {/* Homepage body */}
      <div className="container mx-auto space-y-6 px-4 pt-3 pb-6">

        {/* Sections before promo banner */}
        {renderBlocks(beforePromo)}

        {/* Mid-page promo banner */}
        {spotlightIdx >= 0 && <PromoBanner />}

        {/* Sections after promo banner */}
        {renderBlocks(afterPromo)}

        <TrustpilotCarousel />
        <RecentlyViewed />
      </div>
    </div>
  );
}
