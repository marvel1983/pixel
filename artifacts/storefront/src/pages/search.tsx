import { useMemo, useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { MOCK_PRODUCTS, type MockProduct } from "@/lib/mock-data";
import type { SearchResponse, SearchProduct } from "@/lib/search-types";
import { useListingFilters } from "@/lib/use-listing-filters";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";
import { ProductCard } from "@/components/product/product-card";
import { SearchX, ArrowRight, Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

function toMockProduct(item: SearchProduct): MockProduct {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    imageUrl: item.imageUrl,
    categorySlug: item.categorySlug ?? "uncategorized",
    avgRating: parseFloat(item.avgRating ?? "0"),
    reviewCount: item.reviewCount ?? 0,
    isFeatured: item.isFeatured ?? false,
    isNew: false,
    variants: item.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      platform: v.platform ?? "OTHER",
      priceUsd: v.priceUsd,
      compareAtPriceUsd: v.compareAtPriceUsd,
      stockCount: v.stockCount ?? 0,
    })),
  };
}

function buildApiUrl(
  query: string,
  filters: ReturnType<typeof useListingFilters>["filters"],
  perPage: number,
): string {
  const p = new URLSearchParams();
  p.set("q", query.trim());
  p.set("limit", String(perPage));
  p.set("offset", String((filters.page - 1) * perPage));
  if (filters.categories.length) p.set("cat", filters.categories.join(","));
  if (filters.platforms.length) p.set("plat", filters.platforms.join(","));
  if (filters.minPrice > 0) p.set("min", String(filters.minPrice));
  if (filters.maxPrice < 9999) p.set("max", String(filters.maxPrice));
  if (filters.inStockOnly) p.set("stock", "1");
  if (filters.sort !== "newest") p.set("sort", filters.sort);
  return `${API_URL}/search?${p.toString()}`;
}

export default function SearchPage() {
  const rawSearch = useSearch();
  const params = new URLSearchParams(rawSearch);
  const query = params.get("q") ?? "";
  const { filters, setFilters, perPage } = useListingFilters();
  const [items, setItems] = useState<MockProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    fetch(buildApiUrl(query, filters, perPage))
      .then((r) => r.json())
      .then((data: SearchResponse) => {
        setItems(data.items.map(toMockProduct));
        setTotal(data.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [query, filters, perPage]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const popularProducts = useMemo(
    () =>
      [...MOCK_PRODUCTS]
        .sort((a, b) => b.reviewCount - a.reviewCount)
        .slice(0, 6),
    [],
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: "Search" }]} />

      {query ? (
        <>
          <h1 className="text-2xl font-bold text-foreground mb-6">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Searching...
              </span>
            ) : (
              <>
                {total} {total === 1 ? "result" : "results"} for &ldquo;
                {query}&rdquo;
              </>
            )}
          </h1>

          {!loading && items.length === 0 ? (
            <NoResultsState query={query} suggestions={popularProducts} />
          ) : !loading ? (
            <div className="flex flex-col lg:flex-row gap-6">
              <FilterSidebar filters={filters} onFilterChange={setFilters} />
              <ProductGrid
                products={items}
                totalItems={total}
                currentPage={filters.page}
                totalPages={totalPages}
                sort={filters.sort}
                onSortChange={(sort) => setFilters({ sort })}
                onPageChange={(page) => setFilters({ page })}
              />
            </div>
          ) : null}
        </>
      ) : (
        <NoResultsState query="" suggestions={popularProducts} />
      )}
    </div>
  );
}

function NoResultsState({
  query,
  suggestions,
}: {
  query: string;
  suggestions: MockProduct[];
}) {
  return (
    <div className="text-center py-12">
      <SearchX className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {query ? `No results found for "${query}"` : "Enter a search term"}
      </h2>
      <p className="text-muted-foreground mb-2">
        {query
          ? "Try different keywords, check for typos, or browse our categories."
          : "Search for software, games, license keys, and more."}
      </p>

      {query && (
        <div className="flex flex-wrap justify-center gap-2 mb-8 mt-4">
          {["Windows", "Office", "Antivirus", "Games"].map((term) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className="px-3 py-1.5 bg-muted rounded-full text-sm text-foreground hover:bg-muted/80 transition-colors"
            >
              {term}
            </Link>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-8 text-left">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              Popular Products
            </h3>
            <Link
              href="/shop"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Browse all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {suggestions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
