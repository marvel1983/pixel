import { useMemo } from "react";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import {
  useListingFilters,
  applyFilters,
  paginate,
} from "@/lib/use-listing-filters";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";

export default function HotOffersPage() {
  const { filters, setFilters, perPage } = useListingFilters();

  const featuredProducts = useMemo(
    () => MOCK_PRODUCTS.filter((p) => p.isFeatured),
    [],
  );

  const { items, totalPages, currentPage, totalItems } = useMemo(() => {
    const filtered = applyFilters(featuredProducts, filters);
    return paginate(filtered, filters.page, perPage);
  }, [featuredProducts, filters, perPage]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Hot Offers" }]} />
      <h1 className="text-2xl font-bold text-foreground mb-2">Hot Offers</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Featured products handpicked for you
      </p>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar filters={filters} onFilterChange={setFilters} />
        <ProductGrid
          products={items}
          totalItems={totalItems}
          currentPage={currentPage}
          totalPages={totalPages}
          sort={filters.sort}
          onSortChange={(sort) => setFilters({ sort })}
          onPageChange={(page) => setFilters({ page })}
        />
      </div>
    </div>
  );
}
