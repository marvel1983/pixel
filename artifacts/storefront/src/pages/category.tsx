import { useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { useListingFilters } from "@/lib/use-listing-filters";
import { useProducts, toMockProduct } from "@/lib/use-products";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";
import { CollectionPageJsonLd, BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { ProductGridSkeleton } from "@/components/shop/product-grid-skeleton";
import { setSeoMeta, clearSeoMeta } from "@/lib/seo";

const CATEGORY_KEYS: Record<string, string> = {
  "operating-systems": "categories.operatingSystems",
  "office-productivity": "categories.officeProductivity",
  "antivirus-security": "categories.antivirusSecurity",
  games: "categories.games",
  "servers-development": "categories.serversDevelopment",
};

export default function CategoryPage() {
  const { t } = useTranslation();
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const categoryName = CATEGORY_KEYS[slug] ? t(CATEGORY_KEYS[slug]) : slug;
  const { filters, setFilters, perPage } = useListingFilters();

  const effectiveFilters = useMemo(() => ({ ...filters, categories: [slug] }), [filters, slug]);
  const { items, total, facets, loading } = useProducts(effectiveFilters, perPage);
  const products = useMemo(() => items.map(toMockProduct), [items]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const breadcrumbs = [
    { label: t("shop.title"), href: "/shop" },
    { label: categoryName },
  ];

  useEffect(() => {
    setSeoMeta({ title: `${categoryName} | PixelCodes`, description: `Buy genuine ${categoryName} license keys. Instant digital delivery.`, canonicalUrl: `${window.location.origin}/category/${slug}` });
    return () => { clearSeoMeta(); };
  }, [categoryName, slug]);

  return (
    <div className="container mx-auto px-4 py-6">
      <CollectionPageJsonLd name={categoryName} slug={slug} />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <Breadcrumbs crumbs={breadcrumbs} />
      <h1 className="text-2xl font-bold text-foreground mb-6">{categoryName}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <FilterSidebar
          filters={filters}
          facets={facets}
          onFilterChange={setFilters}
          hideCategoryFilter
        />
        {loading && products.length === 0 ? (
          <ProductGridSkeleton count={8} />
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
