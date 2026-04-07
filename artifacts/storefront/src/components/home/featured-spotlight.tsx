import { useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

interface FeaturedSpotlightProps {
  products: MockProduct[];
}

const TABS = ["Popular", "Best Value", "Top Rated"] as const;

export function FeaturedSpotlight({ products }: FeaturedSpotlightProps) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Popular");

  const sortedProducts = [...products];
  if (activeTab === "Best Value") {
    sortedProducts.sort((a, b) => {
      const aDiscount = getDiscount(a);
      const bDiscount = getDiscount(b);
      return bDiscount - aDiscount;
    });
  } else if (activeTab === "Top Rated") {
    sortedProducts.sort((a, b) => b.avgRating - a.avgRating);
  }

  return (
    <section>
      <div className="flex items-center gap-6 mb-4">
        <h2 className="text-lg font-bold text-foreground">Featured Products</h2>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab}
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
