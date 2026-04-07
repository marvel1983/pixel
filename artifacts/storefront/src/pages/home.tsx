import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { HeroBanner } from "@/components/home/hero-banner";
import { CategorySection } from "@/components/home/category-section";
import { BrandPartnerSection } from "@/components/home/brand-partner-section";
import { FeaturedSpotlight } from "@/components/home/featured-spotlight";
import { NewAdditions } from "@/components/home/new-additions";
import { RecentlyViewed } from "@/components/home/recently-viewed";

const windowsProducts = MOCK_PRODUCTS.filter(
  (p) => p.categorySlug === "operating-systems",
);
const officeProducts = MOCK_PRODUCTS.filter(
  (p) => p.categorySlug === "office-productivity",
);
const antivirusProducts = MOCK_PRODUCTS.filter(
  (p) => p.categorySlug === "antivirus-security",
);
const gameProducts = MOCK_PRODUCTS.filter(
  (p) => p.categorySlug === "games",
);
const newProducts = MOCK_PRODUCTS.filter((p) => p.isNew);
const featuredProducts = MOCK_PRODUCTS.filter((p) => p.isFeatured);

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <HeroBanner />

      <CategorySection
        title="Windows Operating Systems"
        categorySlug="operating-systems"
        products={windowsProducts}
      />

      <BrandPartnerSection
        brandName="Microsoft Office"
        tagline="Lifetime licenses at unbeatable prices. Word, Excel, PowerPoint & more."
        ctaLink="/category/office-productivity"
        bgColor="bg-gradient-to-br from-orange-500 to-red-600"
        products={officeProducts}
      />

      <FeaturedSpotlight products={featuredProducts} />

      <CategorySection
        title="Antivirus & Security"
        categorySlug="antivirus-security"
        products={antivirusProducts}
      />

      <BrandPartnerSection
        brandName="PC Games"
        tagline="Steam, Origin & Epic keys. Instant delivery to your inbox."
        ctaLink="/category/games"
        bgColor="bg-gradient-to-br from-purple-600 to-indigo-700"
        products={gameProducts}
      />

      <NewAdditions products={newProducts} />

      <RecentlyViewed />
    </div>
  );
}
