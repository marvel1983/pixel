import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductCard } from "@/components/product/product-card";
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
    <section>
      <div className="flex items-center gap-6 mb-4">
        <h2 className="text-lg font-bold text-foreground">{t("home.featuredProducts")}</h2>
        <div className="flex gap-1">
          {TAB_KEYS.map((key, i) => (
            <button
              key={key}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === i
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {sortedProducts.slice(0, 6).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function getDiscount(p: MockProduct): number {
  const v = p.variants[0];
  if (!v?.compareAtPriceUsd) return 0;
  const price = parseFloat(v.priceUsd);
  const compare = parseFloat(v.compareAtPriceUsd);
  return Math.round(((compare - price) / compare) * 100);
}
