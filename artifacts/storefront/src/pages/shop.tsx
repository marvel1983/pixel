import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useListingFilters } from "@/lib/use-listing-filters";
import { useProducts } from "@/lib/use-products";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";
import type { MockProduct } from "@/lib/mock-data";

export default function ShopPage() {
  const { t } = useTranslation();
  const { filters, setFilters, perPage } = useListingFilters();
  const { items, total, facets, loading } = useProducts(filters, perPage);

  // Convert API products to MockProduct-compatible shape for ProductCard / ProductGrid
  const products = useMemo<MockProduct[]>(() =>
    items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      imageUrl: p.imageUrl,
      categorySlug: p.categorySlug ?? "",
      avgRating: parseFloat(p.avgRating ?? "0") || 0,
      reviewCount: p.reviewCount,
      isFeatured: p.isFeatured,
      isNew: false,
      regionRestrictions: [],
      platformType: null,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        platform: v.platform ?? "",
        priceUsd: v.priceUsd,
        compareAtPriceUsd: v.compareAtPriceUsd,
        stockCount: v.stockCount,
      })),
    })),
  [items]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("shop.title") }]} />
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("shop.title")}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar
          filters={filters}
          facets={facets}
          onFilterChange={setFilters}
        />
        <div className="flex-1">
          {loading && products.length === 0 && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Loading products…
            </div>
          )}
          {!loading || products.length > 0 ? (
            <ProductGrid
              products={products}
              totalItems={total}
              currentPage={filters.page}
              totalPages={totalPages}
              sort={filters.sort}
              onSortChange={(sort) => setFilters({ sort })}
              onPageChange={(page) => setFilters({ page })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
