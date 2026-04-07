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

export default function ShopPage() {
  const { filters, setFilters, perPage } = useListingFilters();

  const { items, totalPages, currentPage, totalItems } = useMemo(() => {
    const filtered = applyFilters(MOCK_PRODUCTS, filters);
    return paginate(filtered, filters.page, perPage);
  }, [filters, perPage]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Shop" }]} />
      <h1 className="text-2xl font-bold text-foreground mb-6">All Products</h1>

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
