import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { MockProduct } from "@/lib/mock-data";
import type { SearchResponse, SearchProduct, SearchBundleHit } from "@/lib/search-types";
import { useListingFilters } from "@/lib/use-listing-filters";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";
import { ProductCard } from "@/components/product/product-card";
import { SearchX, ArrowRight, Loader2, Package } from "lucide-react";
import { useCurrencyStore } from "@/stores/currency-store";
import { fireSearch, fireViewItemList } from "@/components/tracking/analytics";

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
      backorderAllowed: v.backorderAllowed,
      backorderEta: v.backorderEta,
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
  const { t } = useTranslation();
  const rawSearch = useSearch();
  const params = new URLSearchParams(rawSearch);
  const query = params.get("q") ?? "";
  const { filters, setFilters, perPage } = useListingFilters();
  const [items, setItems] = useState<MockProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [bundleHits, setBundleHits] = useState<SearchBundleHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [popularProducts, setPopularProducts] = useState<MockProduct[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/products?sort=popular&limit=6&stock=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items) setPopularProducts(data.items.map(toMockProduct));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    fetch(buildApiUrl(query, filters, perPage), { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`search ${r.status}`);
        return r.json();
      })
      .then((data: SearchResponse) => {
        const list = Array.isArray(data.items) ? data.items : [];
        const mapped = list.map(toMockProduct);
        setItems(mapped);
        const tot = typeof data.total === "number" ? data.total : 0;
        setTotal(tot);
        setBundleHits(data.bundleHits ?? []);
        fireSearch(query, tot + (data.bundleHits?.length ?? 0));
        if (mapped.length > 0) {
          fireViewItemList(
            mapped.map((p) => ({ id: p.id, name: p.name, category: p.categorySlug, price: parseFloat(p.variants[0]?.priceUsd ?? "0") })),
            "Search Results",
          );
        }
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [query, filters, perPage]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const combinedTotal = total + bundleHits.length;

  return (
    <div className="container mx-auto px-4 py-6">
      <Breadcrumbs crumbs={[{ label: t("search.title") }]} />

      {query ? (
        <>
          <h1 className="text-2xl font-bold text-foreground mb-6">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> {t("search.searching")}
              </span>
            ) : (
              <>
                {combinedTotal} {combinedTotal === 1 ? t("search.result") : t("search.results")}{" "}
                &ldquo;{query}&rdquo;
              </>
            )}
          </h1>

          {!loading && bundleHits.length > 0 && (
            <BundleHitsSection bundles={bundleHits} />
          )}

          {!loading && items.length === 0 && bundleHits.length === 0 ? (
            <NoResultsState query={query} suggestions={popularProducts} t={t} />
          ) : !loading && items.length > 0 ? (
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
        <NoResultsState query="" suggestions={popularProducts} t={t} />
      )}
    </div>
  );
}

function BundleHitsSection({ bundles }: { bundles: SearchBundleHit[] }) {
  const format = useCurrencyStore((s) => s.format);
  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" /> Bundles
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {bundles.map((b) => {
          const image = b.imageUrl ?? b.anchorImageUrl ?? null;
          const rating = parseFloat(b.anchorAvgRating ?? "0");
          const reviewCount = b.anchorReviewCount ?? 0;
          return (
            <Link key={b.id} href={`/bundles/${b.slug}`}>
              <div className="group bg-card border border-border rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-[shadow,transform] duration-150 h-full flex flex-col">
                <div className="relative aspect-[3/4] shrink-0 rounded-t-lg">
                  <div className="absolute inset-0 overflow-hidden rounded-t-lg bg-white">
                    {image ? (
                      <img src={image} alt={b.name} className="h-full w-full object-contain p-3" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-sm">
                    <Package className="h-3 w-3" /> Bundle
                  </span>
                </div>
                <div className="flex flex-1 flex-col items-center p-3 text-center">
                  <h3 className="text-sm font-medium line-clamp-2 mb-1 group-hover:text-primary transition-colors">{b.name}</h3>
                  <p className="text-xs text-muted-foreground mb-1">{b.itemCount} products</p>
                  {reviewCount > 0 && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
                      <span className="text-amber-500">★</span>
                      <span>{rating.toFixed(1)}</span>
                      <span>({reviewCount})</span>
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    <span className="text-lg font-bold">{format(parseFloat(b.bundlePriceUsd))}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NoResultsState({
  query,
  suggestions,
  t,
}: {
  query: string;
  suggestions: MockProduct[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="text-center py-12">
      <SearchX className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {query ? t("search.noResults", { query }) : t("search.enterSearchTerm")}
      </h2>
      <p className="text-muted-foreground mb-2">
        {query ? t("search.tryDifferent") : t("search.searchHint")}
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
              {t("search.popularProducts")}
            </h3>
            <Link
              href="/shop"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {t("search.browseAll")} <ArrowRight className="h-3 w-3" />
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
