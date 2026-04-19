import { useMemo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Tag, Zap, Flame, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shop/breadcrumbs";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { ProductGrid } from "@/components/shop/product-grid";
import { useListingFilters } from "@/lib/use-listing-filters";
import { useProducts } from "@/lib/use-products";
import { useFlashSaleStore } from "@/stores/flash-sale-store";
import type { MockProduct } from "@/lib/mock-data";

const URGENCY_TAGS = [
  { icon: <Zap className="h-4 w-4 text-amber-400" />, text: "Prices reset without notice" },
  { icon: <Flame className="h-4 w-4 text-red-400" />, text: "Stock limited — keys sell fast" },
  { icon: <ShoppingCart className="h-4 w-4 text-green-400" />, text: "Instant email delivery" },
];

export default function DealsPage() {
  const { t } = useTranslation();
  const { filters, setFilters, perPage } = useListingFilters({ defaultSort: "discount-desc" });
  const { items, total, facets, loading } = useProducts(filters, perPage);
  const flashSaleActive = useFlashSaleStore((s) => s.endsAt !== null);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

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

  return (
    <div>
      {/* Hero header */}
      <div
        className="w-full"
        style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2346 60%, #0a1628 100%)" }}
      >
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center gap-2">
              <Tag className="h-6 w-6 text-amber-400" />
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Today's Best Deals</h1>
              <Tag className="h-6 w-6 text-amber-400" />
            </div>
            <p className="text-white/60 text-sm max-w-lg">
              Hand-picked discounts on genuine license keys — sorted by biggest saving. No coupon needed.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-1">
              {URGENCY_TAGS.map((u) => (
                <div key={u.text} className="flex items-center gap-1.5 text-sm text-white/70">
                  {u.icon}
                  <span>{u.text}</span>
                </div>
              ))}
            </div>
            {flashSaleActive && (
              <Link href="/flash-sale">
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white border-0 flex items-center gap-1.5 mt-2"
                >
                  <Zap className="h-3.5 w-3.5 fill-white" />
                  Flash Sale active — even deeper cuts!
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="container mx-auto px-4 py-6">
        <Breadcrumbs crumbs={[{ label: "Deals" }]} />
        <div className="flex flex-col lg:flex-row gap-6">
          <FilterSidebar filters={filters} facets={facets} onFilterChange={setFilters} />
          <div className="flex-1">
            {loading && products.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Loading deals…
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
      </div>
    </div>
  );
}
