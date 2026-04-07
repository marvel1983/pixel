import { useMemo, useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { MOCK_PRODUCTS, type MockProduct } from "@/lib/mock-data";
import {
  useListingFilters,
  applyFilters,
  paginate,
} from "@/lib/use-listing-filters";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";
import { ProductCard } from "@/components/product/product-card";
import { SearchX, ArrowRight, Loader2 } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL ?? "/api";

function toMockProduct(item: any): MockProduct {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    imageUrl: item.imageUrl,
    categorySlug: item.categoryId ? `cat-${item.categoryId}` : "uncategorized",
    avgRating: parseFloat(item.avgRating ?? "0"),
    reviewCount: item.reviewCount ?? 0,
    isFeatured: item.isFeatured ?? false,
    isNew: false,
    description: item.description,
    variants: (item.variants ?? []).map((v: any) => ({
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

export default function SearchPage() {
  const rawSearch = useSearch();
  const params = new URLSearchParams(rawSearch);
  const query = params.get("q") ?? "";
  const { filters, setFilters, perPage } = useListingFilters();
  const [apiResults, setApiResults] = useState<MockProduct[]>([]);
  const [apiTotal, setApiTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setApiResults([]);
      setApiTotal(0);
      return;
    }
    setLoading(true);
    fetch(`${API_URL}/search?q=${encodeURIComponent(query.trim())}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        setApiResults(data.items.map(toMockProduct));
        setApiTotal(data.total ?? data.items.length);
      })
      .catch(() => {
        setApiResults([]);
        setApiTotal(0);
      })
      .finally(() => setLoading(false));
  }, [query]);

  const { items, totalPages, currentPage, totalItems } = useMemo(() => {
    const filtered = applyFilters(apiResults, filters);
    return paginate(filtered, filters.page, perPage);
  }, [apiResults, filters, perPage]);

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
                {apiTotal} {apiTotal === 1 ? "result" : "results"} for &ldquo;
                {query}&rdquo;
              </>
            )}
          </h1>

          {!loading && apiResults.length === 0 ? (
            <NoResultsState query={query} suggestions={popularProducts} />
          ) : !loading ? (
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
