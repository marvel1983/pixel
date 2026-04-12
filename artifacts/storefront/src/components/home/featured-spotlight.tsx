import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductCard } from "@/components/product/product-card";
import { SectionHeader } from "@/components/home/page-section";
import type { MockProduct } from "@/lib/mock-data";

interface FeaturedSpotlightProps {
  products: MockProduct[];
}

const TAB_KEYS = ["home.popular", "home.bestValue", "home.topRated"] as const;

export function FeaturedSpotlight({ products }: FeaturedSpotlightProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const sortedProducts = [...products];
  if (activeTab === 1) {
    sortedProducts.sort((a, b) => getDiscount(b) - getDiscount(a));
  } else if (activeTab === 2) {
    sortedProducts.sort((a, b) => b.avgRating - a.avgRating);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <SectionHeader
          className="mb-0 shrink-0 lg:max-w-xl"
          eyebrow={t("home.featuredSpotlightEyebrow")}
          title={t("home.featuredProducts")}
          subtitle={t("home.featuredSubtitle")}
          id="section-featured"
        />
        <div className="flex flex-shrink-0 flex-wrap gap-1.5" role="tablist" aria-label={t("home.featuredProducts")}>
          {TAB_KEYS.map((key, i) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === i}
              onClick={() => setActiveTab(i)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {sortedProducts.slice(0, 5).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {sortedProducts.length >= 10 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mt-3">
          {sortedProducts.slice(5, 10).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function getDiscount(p: MockProduct): number {
  const v = p.variants[0];
  if (!v?.compareAtPriceUsd) return 0;
  const price = parseFloat(v.priceUsd);
  const compare = parseFloat(v.compareAtPriceUsd);
  return Math.round(((compare - price) / compare) * 100);
}
