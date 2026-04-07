import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { HeroBanner } from "@/components/home/hero-banner";
import { CategorySection } from "@/components/home/category-section";
import { BrandPartnerSection } from "@/components/home/brand-partner-section";
import { FeaturedSpotlight } from "@/components/home/featured-spotlight";
import { NewAdditions } from "@/components/home/new-additions";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { FeaturedBundles } from "@/components/home/featured-bundles";
import { TrustpilotCarousel } from "@/components/trustpilot/trustpilot-carousel";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Section { id: number; type: string; title: string | null; isEnabled: boolean; sortOrder: number; config: Record<string, unknown> }

const windowsProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "operating-systems");
const officeProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "office-productivity");
const antivirusProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "antivirus-security");
const gameProducts = MOCK_PRODUCTS.filter((p) => p.categorySlug === "games");
const newProducts = MOCK_PRODUCTS.filter((p) => p.isNew);
const featuredProducts = MOCK_PRODUCTS.filter((p) => p.isFeatured);

const ALL_TYPES = ["HERO_SLIDER", "CATEGORY_ROW", "BRAND_SECTIONS", "NEW_ADDITIONS", "PRODUCT_SPOTLIGHT", "FEATURED_TEXT_BANNER", "FEATURED_BUNDLES"];

function renderSection(type: string) {
  switch (type) {
    case "HERO_SLIDER": return <HeroBanner key={type} />;
    case "CATEGORY_ROW": return (
      <div key={type} className="space-y-8">
        <CategorySection title="Windows Operating Systems" categorySlug="operating-systems" products={windowsProducts} />
        <CategorySection title="Office & Productivity" categorySlug="office-productivity" products={officeProducts} />
        <CategorySection title="Antivirus & Security" categorySlug="antivirus-security" products={antivirusProducts} />
      </div>
    );
    case "BRAND_SECTIONS": return (
      <div key={type} className="space-y-8">
        <BrandPartnerSection brandName="Microsoft Office" tagline="Lifetime licenses at unbeatable prices. Word, Excel, PowerPoint & more."
          ctaLink="/category/office-productivity" bgColor="bg-gradient-to-br from-orange-500 to-red-600" products={officeProducts} />
        <BrandPartnerSection brandName="PC Games" tagline="Steam, Origin & Epic keys. Instant delivery to your inbox."
          ctaLink="/category/games" bgColor="bg-gradient-to-br from-purple-600 to-indigo-700" products={gameProducts} />
      </div>
    );
    case "PRODUCT_SPOTLIGHT": return <FeaturedSpotlight key={type} products={featuredProducts} />;
    case "FEATURED_BUNDLES": return <FeaturedBundles key={type} />;
    case "NEW_ADDITIONS": return <NewAdditions key={type} products={newProducts} />;
    default: return null;
  }
}

export default function HomePage() {
  const { t } = useTranslation();
  const [sectionTypes, setSectionTypes] = useState<string[]>(ALL_TYPES);

  useEffect(() => {
    document.title = t("seo.homeTitle");
    return () => { document.title = "PixelCodes"; };
  }, [t]);

  useEffect(() => {
    fetch(`${API}/homepage-sections`)
      .then((r) => r.json())
      .then((d: { sections: Section[] }) => {
        if (d.sections?.length) setSectionTypes(d.sections.map((s) => s.type));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      {sectionTypes.map((type) => renderSection(type))}
      <TrustpilotCarousel />
      <RecentlyViewed />
    </div>
  );
}
