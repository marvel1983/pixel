import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useListingFilters } from "@/lib/use-listing-filters";
import { useProducts, toMockProduct } from "@/lib/use-products";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";

const FEATURED = { featured: "1" };

export default function HotOffersPage() {
  const { t } = useTranslation();
  const { filters, setFilters, perPage } = useListingFilters();
  const { items, total, facets, loading } = useProducts(filters, perPage, FEATURED);
  const products = useMemo(() => items.map(toMockProduct), [items]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("hotOffers.title") }]} />
      <h1 className="text-2xl font-bold text-foreground mb-2">{t("hotOffers.title")}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t("hotOffers.subtitle")}</p>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar filters={filters} facets={facets} onFilterChange={setFilters} />
        {loading && products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16 text-muted-foreground text-sm">
            Loading products…
          </div>
        ) : (
          <ProductGrid
            products={products}
            totalItems={total}
            currentPage={filters.page}
            totalPages={totalPages}
            sort={filters.sort}
            onSortChange={(sort) => setFilters({ sort })}
            onPageChange={(page) => setFilters({ page })}
          />
        )}
      </div>
    </div>
  );
}
