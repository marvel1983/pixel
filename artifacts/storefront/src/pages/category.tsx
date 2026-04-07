import { useMemo } from "react";
import { useParams } from "wouter";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import {
  useListingFilters,
  applyFilters,
  paginate,
} from "@/lib/use-listing-filters";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";

const CATEGORY_NAMES: Record<string, string> = {
  "operating-systems": "Operating Systems",
  "office-productivity": "Office & Productivity",
  "antivirus-security": "Antivirus & Security",
  games: "Games",
  "servers-development": "Servers & Development",
};

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const categoryName = CATEGORY_NAMES[slug] ?? slug;
  const { filters, setFilters, perPage } = useListingFilters();

  const categoryProducts = useMemo(
    () => MOCK_PRODUCTS.filter((p) => p.categorySlug === slug),
    [slug],
  );

  const { items, totalPages, currentPage, totalItems } = useMemo(() => {
    const filtered = applyFilters(categoryProducts, {
      ...filters,
      categories: [],
    });
    return paginate(filtered, filters.page, perPage);
  }, [categoryProducts, filters, perPage]);

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs
        crumbs={[
          { label: "Shop", href: "/shop" },
          { label: categoryName },
        ]}
      />
      <h1 className="text-2xl font-bold text-foreground mb-6">
        {categoryName}
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar
          filters={filters}
          onFilterChange={setFilters}
          hideCategoryFilter
        />
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
