import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ProductCard } from "@/components/product/product-card";
import type { MockProduct } from "@/lib/mock-data";

const API = import.meta.env.VITE_API_URL ?? "/api";
const STORAGE_KEY = "pixelcodes-recently-viewed";
const MAX_ITEMS = 6;

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

function toMock(p: ApiProduct): MockProduct {
  return {
    id: p.id, name: p.name, slug: p.slug, imageUrl: p.imageUrl,
    categorySlug: p.categorySlug ?? "", avgRating: Number(p.avgRating ?? 0),
    reviewCount: p.reviewCount, isFeatured: p.isFeatured, isNew: false,
    regionRestrictions: p.regionRestrictions ?? [], platformType: p.platformType ?? null,
    variants: p.variants.map((v) => ({
      id: v.id, name: v.name, sku: v.sku, platform: v.platform ?? "",
      priceUsd: v.priceUsd, compareAtPriceUsd: v.compareAtPriceUsd, stockCount: v.stockCount,
    })),
  };
}

export function addToRecentlyViewed(productId: number) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ids: number[] = stored ? JSON.parse(stored) : [];
    const filtered = ids.filter((id) => id !== productId);
    filtered.unshift(productId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
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
  const { t } = useTranslation();
  const [products, setProducts] = useState<MockProduct[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewedIds();
    if (ids.length === 0) return;

    fetch(`${API}/products?ids=${ids.join(",")}&limit=${MAX_ITEMS}&stock=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: ApiProduct[] } | null) => {
        if (!d?.items?.length) return;
        // preserve the order from localStorage
        const byId = new Map(d.items.map((p) => [p.id, p]));
        const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as ApiProduct[];
        setProducts(ordered.map(toMock));
      })
      .catch(() => {});
  }, []);

  if (products.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="mb-4 text-lg font-bold text-foreground">
        {t("home.recentlyViewed")}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
