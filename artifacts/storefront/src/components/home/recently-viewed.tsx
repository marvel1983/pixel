import { useState, useEffect } from "react";
import { ProductCard } from "@/components/product/product-card";
import { MOCK_PRODUCTS, type MockProduct } from "@/lib/mock-data";

const STORAGE_KEY = "pixelcodes-recently-viewed";
const MAX_ITEMS = 6;

export function addToRecentlyViewed(productId: number) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ids: number[] = stored ? JSON.parse(stored) : [];
    const filtered = ids.filter((id) => id !== productId);
    filtered.unshift(productId);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(filtered.slice(0, MAX_ITEMS)),
    );
  } catch {
    // ignore storage errors
  }
}

function getRecentlyViewedIds(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function RecentlyViewed() {
  const [products, setProducts] = useState<MockProduct[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewedIds();
    const found = ids
      .map((id) => MOCK_PRODUCTS.find((p) => p.id === id))
      .filter(Boolean) as MockProduct[];
    setProducts(found);
  }, []);

  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-bold text-foreground mb-4">
        Recently Viewed
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
